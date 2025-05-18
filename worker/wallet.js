import {
  getInvoice,
  subscribeToInvoices, subscribeToPayments, subscribeToInvoice
} from 'ln-service'
import { getPaymentOrNotSent } from '@/api/lnd'
import { sleep } from '@/lib/time'
import retry from 'async-retry'
import {
  paidActionPaid, paidActionForwarded,
  paidActionFailedForward, paidActionHeld, paidActionFailed,
  paidActionForwarding,
  paidActionCanceling
} from './paidAction'
import { payingActionConfirmed, payingActionFailed } from './payingAction'
import { canReceive, getWalletByType } from '@/wallets/common'
import { notifyNewStreak, notifyStreakLost } from '@/lib/webPush'
import { hasVault, vaultPrismaFragments } from '@/wallets/vault'

export async function subscribeToWallet (args) {
  await subscribeToDeposits(args)
  await subscribeToWithdrawals(args)
}

// lnd subscriptions can fail, so they need to be retried
function subscribeForever (subscribe) {
  retry(async bail => {
    let sub
    try {
      return await new Promise((resolve, reject) => {
        sub = subscribe(resolve, bail)
        if (!sub) {
          return bail(new Error('function passed to subscribeForever must return a subscription object or promise'))
        }
        if (sub.then) {
          // sub is promise
          sub.then(resolved => {
            sub = resolved
            sub.on('error', reject)
          })
        } else {
          sub.on('error', reject)
        }
      })
    } catch (error) {
      console.error(error)
      throw new Error('error subscribing - trying again')
    } finally {
      sub?.removeAllListeners()
    }
  },
  // retry every .1-10 seconds forever
  { forever: true, minTimeout: 100, maxTimeout: 10000, onRetry: e => console.error(e.message) })
}

const logEvent = (name, args) => console.log(`event ${name} triggered with args`, args)
const logEventError = (name, error) => console.error(`error running ${name}`, error)

async function subscribeToDeposits (args) {
  const { models, lnd } = args

  subscribeForever(async () => {
    const [lastConfirmed] = await models.$queryRaw`
    SELECT "confirmedIndex"
    FROM "Invoice"
    ORDER BY "confirmedIndex" DESC NULLS LAST
    LIMIT 1`
    const sub = subscribeToInvoices({ lnd, confirmed_after: lastConfirmed?.confirmedIndex })

    sub.on('invoice_updated', async (inv) => {
      try {
        logEvent('invoice_updated', inv)
        if (inv.secret) {
          // subscribeToInvoices only returns when added or settled
          await checkInvoice({ data: { hash: inv.id, invoice: inv }, ...args })
        } else {
          // this is a HODL invoice. We need to use SubscribeToInvoice which has is_held transitions
          // and is_canceled transitions https://api.lightning.community/api/lnd/invoices/subscribe-single-invoice
          // SubscribeToInvoices is only for invoice creation and settlement transitions
          // https://api.lightning.community/api/lnd/lightning/subscribe-invoices
          subscribeToHodlInvoice({ hash: inv.id, ...args })
        }
      } catch (error) {
        logEventError('invoice_updated', error)
      }
    })

    return sub
  })

  // check pending deposits as a redundancy in case we failed to rehcord
  // an invoice_updated event
  await checkPendingDeposits(args)
}

function subscribeToHodlInvoice (args) {
  const { lnd, hash } = args

  subscribeForever((resolve, reject) => {
    const sub = subscribeToInvoice({ id: hash, lnd })

    sub.on('invoice_updated', async (inv) => {
      logEvent('hodl_invoice_updated', inv)
      try {
        await checkInvoice({ data: { hash: inv.id, invoice: inv }, ...args })
        // after settle or confirm we can stop listening for updates
        if (inv.is_confirmed || inv.is_canceled) {
          resolve()
        }
      } catch (error) {
        logEventError('hodl_invoice_updated', error)
        reject(error)
      }
    })

    return sub
  })
}

// if we already have the invoice from a subscription event or previous call,
// we can skip a getInvoice call
export async function checkInvoice ({ data: { hash, invoice }, boss, models, lnd }) {
  const inv = invoice ?? await getInvoice({ id: hash, lnd })

  // invoice could be created by LND but wasn't inserted into the database yet
  // this is expected and the function will be called again with the updates
  const dbInv = await models.invoice.findUnique({
    where: { hash },
    include: {
      invoiceForward: {
        include: {
          withdrawl: true
        }
      }
    }
  })
  if (!dbInv) {
    console.log('invoice not found in database', hash)
    return
  }

  if (inv.is_confirmed) {
    if (dbInv.actionType) {
      return await paidActionPaid({ data: { invoiceId: dbInv.id, invoice: inv }, models, lnd, boss })
    }
  }

  if (inv.is_held) {
    if (dbInv.actionType) {
      if (dbInv.invoiceForward) {
        if (dbInv.invoiceForward.withdrawl) {
          // transitions when held are dependent on the withdrawl status
          return await checkWithdrawal({ data: { hash: dbInv.invoiceForward.withdrawl.hash, invoice: inv }, models, lnd, boss })
        }
        return await paidActionForwarding({ data: { invoiceId: dbInv.id, invoice: inv }, models, lnd, boss })
      }
      return await paidActionHeld({ data: { invoiceId: dbInv.id, invoice: inv }, models, lnd, boss })
    }
  }

  if (inv.is_canceled) {
    if (dbInv.actionType) {
      return await paidActionFailed({ data: { invoiceId: dbInv.id, invoice: inv }, models, lnd, boss })
    }
  }
}

async function subscribeToWithdrawals (args) {
  const { lnd } = args

  // https://www.npmjs.com/package/ln-service#subscribetopayments
  subscribeForever(() => {
    const sub = subscribeToPayments({ lnd })

    sub.on('confirmed', async (payment) => {
      logEvent('confirmed', payment)
      try {
        // see https://github.com/alexbosworth/lightning/blob/ddf1f214ebddf62e9e19fd32a57fbeeba713340d/lnd_methods/offchain/subscribe_to_payments.js
        const withdrawal = { payment, is_confirmed: true }
        await checkWithdrawal({ data: { hash: payment.id, withdrawal }, ...args })
      } catch (error) {
        logEventError('confirmed', error)
      }
    })

    sub.on('failed', async (payment) => {
      logEvent('failed', payment)
      try {
        // see https://github.com/alexbosworth/lightning/blob/ddf1f214ebddf62e9e19fd32a57fbeeba713340d/lnd_methods/offchain/subscribe_to_payments.js
        const withdrawal = { failed: payment, is_failed: true }
        await checkWithdrawal({ data: { hash: payment.id, withdrawal }, ...args })
      } catch (error) {
        logEventError('failed', error)
      }
    })

    return sub
  })

  // check pending withdrawals since they might have been paid while worker was down
  await checkPendingWithdrawals(args)
}

// if we already have the payment from a subscription event or previous call,
// we can skip a getPayment call
export async function checkWithdrawal ({ data: { hash, withdrawal, invoice }, boss, models, lnd }) {
  // get the withdrawl if pending or it's an invoiceForward
  const dbWdrwl = await models.withdrawl.findFirst({
    where: {
      hash,
      OR: [
        { status: null },
        { invoiceForward: { isNot: null } }
      ]
    },
    include: {
      wallet: true,
      invoiceForward: {
        include: {
          invoice: true
        }
      }
    }
  })

  // nothing to do if the withdrawl is already recorded and it isn't an invoiceForward
  if (!dbWdrwl) return

  const wdrwl = withdrawal ?? await getPaymentOrNotSent({ id: hash, lnd, createdAt: dbWdrwl.createdAt })

  if (wdrwl?.is_confirmed) {
    if (dbWdrwl.invoiceForward) {
      return await paidActionForwarded({ data: { invoiceId: dbWdrwl.invoiceForward.invoice.id, withdrawal: wdrwl, invoice }, models, lnd, boss })
    }

    return await payingActionConfirmed({ data: { withdrawalId: dbWdrwl.id, withdrawal: wdrwl }, models, lnd, boss })
  } else if (wdrwl?.is_failed || wdrwl?.notSent) {
    if (dbWdrwl.invoiceForward) {
      return await paidActionFailedForward({ data: { invoiceId: dbWdrwl.invoiceForward.invoice.id, withdrawal: wdrwl, invoice }, models, lnd, boss })
    }

    return await payingActionFailed({ data: { withdrawalId: dbWdrwl.id, withdrawal: wdrwl }, models, lnd, boss })
  }
}

// The callback subscriptions above will NOT get called for JIT invoices that are already paid.
// So we manually cancel the HODL invoice here if it wasn't settled by user action
export async function finalizeHodlInvoice ({ data: { hash }, models, lnd, boss, ...args }) {
  const inv = await getInvoice({ id: hash, lnd })
  if (inv.is_confirmed) {
    return
  }

  const dbInv = await models.invoice.findUnique({ where: { hash } })
  if (!dbInv) {
    console.log('invoice not found in database', hash)
    return
  }

  await paidActionCanceling({ data: { invoiceId: dbInv.id, invoice: inv }, models, lnd, boss })

  // sync LND invoice status with invoice status in database
  await checkInvoice({ data: { hash }, models, lnd, boss })
}

export async function checkPendingDeposits (args) {
  const { models } = args
  const pendingDeposits = await models.invoice.findMany({ where: { confirmedAt: null, cancelled: false } })
  for (const d of pendingDeposits) {
    try {
      await checkInvoice({ ...args, data: { hash: d.hash } })
      await sleep(10)
    } catch {
      console.error('error checking invoice', d.hash)
    }
  }
}

export async function checkPendingWithdrawals (args) {
  const { models } = args
  const pendingWithdrawals = await models.withdrawl.findMany({ where: { status: null } })
  for (const w of pendingWithdrawals) {
    try {
      await checkWithdrawal({ ...args, data: { hash: w.hash } })
      await sleep(10)
    } catch (err) {
      console.error('error checking withdrawal', w.hash, err)
    }
  }
}

export async function checkWallet ({ data: { userId }, models }) {
  const pushNotifications = []

  await models.$transaction(async tx => {
    // TODO(wallet-v2): use UserWallet instead of Wallet table
    const wallets = await tx.wallet.findMany({
      where: {
        userId,
        enabled: true
      },
      include: vaultPrismaFragments.include()
    })

    const { hasRecvWallet: oldHasRecvWallet, hasSendWallet: oldHasSendWallet } = await tx.user.findUnique({ where: { id: userId } })

    const newHasRecvWallet = wallets.some(({ type, wallet }) => canReceive({ def: getWalletByType(type), config: wallet }))
    const newHasSendWallet = wallets.some(hasVault)

    await tx.user.update({
      where: { id: userId },
      data: {
        hasRecvWallet: newHasRecvWallet,
        hasSendWallet: newHasSendWallet
      }
    })

    const startStreak = async (type) => {
      const streak = await tx.streak.create({
        data: { userId, type, startedAt: new Date() }
      })
      return streak.id
    }

    const endStreak = async (type) => {
      const [streak] = await tx.$queryRaw`
        UPDATE "Streak"
        SET "endedAt" = now(), updated_at = now()
        WHERE "userId" = ${userId}
        AND "type" = ${type}::"StreakType"
        AND "endedAt" IS NULL
        RETURNING "id"
      `
      return streak?.id
    }

    if (!oldHasRecvWallet && newHasRecvWallet) {
      const streakId = await startStreak('HORSE')
      if (streakId) pushNotifications.push(() => notifyNewStreak(userId, { type: 'HORSE', id: streakId }))
    }
    if (!oldHasSendWallet && newHasSendWallet) {
      const streakId = await startStreak('GUN')
      if (streakId) pushNotifications.push(() => notifyNewStreak(userId, { type: 'GUN', id: streakId }))
    }

    if (oldHasRecvWallet && !newHasRecvWallet) {
      const streakId = await endStreak('HORSE')
      if (streakId) pushNotifications.push(() => notifyStreakLost(userId, { type: 'HORSE', id: streakId }))
    }
    if (oldHasSendWallet && !newHasSendWallet) {
      const streakId = await endStreak('GUN')
      if (streakId) pushNotifications.push(() => notifyStreakLost(userId, { type: 'GUN', id: streakId }))
    }
  })

  // run all push notifications at the end to make sure we don't
  // accidentally send duplicate push notifications because of a job retry
  await Promise.all(pushNotifications.map(notify => notify())).catch(console.error)
}
