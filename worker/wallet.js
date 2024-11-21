import serialize from '@/api/resolvers/serial'
import {
  getInvoice, getPayment, cancelHodlInvoice, deletePayment,
  subscribeToInvoices, subscribeToPayments, subscribeToInvoice
} from 'ln-service'
import { notifyDeposit, notifyWithdrawal } from '@/lib/webPush'
import { INVOICE_RETENTION_DAYS, LND_PATHFINDING_TIMEOUT_MS } from '@/lib/constants'
import { datePivot, sleep } from '@/lib/time'
import retry from 'async-retry'
import {
  paidActionPaid, paidActionForwarded,
  paidActionFailedForward, paidActionHeld, paidActionFailed,
  paidActionForwarding,
  paidActionCanceling
} from './paidAction'
import { getPaymentFailureStatus } from '@/api/lnd/index.js'
import { walletLogger } from '@/api/resolvers/wallet.js'
import { formatMsats, formatSats, msatsToSats } from '@/lib/format.js'

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

    // XXX we need to keep this to allow production to migrate to new paidAction flow
    // once all non-paidAction receive invoices are migrated, we can remove this
    const [[{ confirm_invoice: code }]] = await serialize([
      models.$queryRaw`SELECT confirm_invoice(${inv.id}, ${Number(inv.received_mtokens)})`,
      models.invoice.update({ where: { hash }, data: { confirmedIndex: inv.confirmed_index } })
    ], { models })

    if (code === 0) {
      notifyDeposit(dbInv.userId, { comment: dbInv.comment, ...inv })
    }

    return await boss.send('nip57', { hash })
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

    return await serialize(
      models.invoice.update({
        where: {
          hash: inv.id
        },
        data: {
          cancelled: true
        }
      }), { models }
    )
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
        { invoiceForward: { some: { } } }
      ]
    },
    include: {
      wallet: true,
      invoiceForward: {
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: true
        }
      }
    }
  })

  // nothing to do if the withdrawl is already recorded and it isn't an invoiceForward
  if (!dbWdrwl) return

  let wdrwl
  let notSent = false
  try {
    wdrwl = withdrawal ?? await getPayment({ id: hash, lnd })
  } catch (err) {
    if (err[1] === 'SentPaymentNotFound' &&
      dbWdrwl.createdAt < datePivot(new Date(), { milliseconds: -LND_PATHFINDING_TIMEOUT_MS * 2 })) {
      // if the payment is older than 2x timeout, but not found in LND, we can assume it errored before lnd stored it
      notSent = true
    } else {
      throw err
    }
  }

  const logger = walletLogger({ models, wallet: dbWdrwl.wallet })

  if (wdrwl?.is_confirmed) {
    if (dbWdrwl.invoiceForward.length > 0) {
      return await paidActionForwarded({ data: { invoiceId: dbWdrwl.invoiceForward[0].invoice.id, withdrawal: wdrwl, invoice }, models, lnd, boss })
    }

    const fee = Number(wdrwl.payment.fee_mtokens)
    const paid = Number(wdrwl.payment.mtokens) - fee
    const [[{ confirm_withdrawl: code }]] = await serialize([
      models.$queryRaw`SELECT confirm_withdrawl(${dbWdrwl.id}::INTEGER, ${paid}, ${fee})`,
      models.withdrawl.update({
        where: { id: dbWdrwl.id },
        data: {
          preimage: wdrwl.payment.secret
        }
      })
    ], { models })
    if (code === 0) {
      notifyWithdrawal(dbWdrwl.userId, wdrwl)

      const { request: bolt11, secret: preimage } = wdrwl.payment

      logger?.ok(
        `↙ payment received: ${formatSats(msatsToSats(paid))}`,
        {
          bolt11,
          preimage,
          fee: formatMsats(fee)
        })
    }
  } else if (wdrwl?.is_failed || notSent) {
    if (dbWdrwl.invoiceForward.length > 0) {
      return await paidActionFailedForward({ data: { invoiceId: dbWdrwl.invoiceForward[0].invoice.id, withdrawal: wdrwl, invoice }, models, lnd, boss })
    }

    const { message, status } = getPaymentFailureStatus(wdrwl)
    await serialize(
      models.$queryRaw`
        SELECT reverse_withdrawl(${dbWdrwl.id}::INTEGER, ${status}::"WithdrawlStatus")`,
      { models }
    )

    logger?.error(
      `incoming payment failed: ${message}`,
      {
        bolt11: wdrwl.payment.request,
        max_fee: formatMsats(dbWdrwl.msatsFeePaying)
      })
  }
}

export async function autoDropBolt11s ({ models, lnd }) {
  const retention = `${INVOICE_RETENTION_DAYS} days`

  // This query will update the withdrawls and return what the hash and bol11 values were before the update
  const invoices = await models.$queryRaw`
    WITH to_be_updated AS (
      SELECT id, hash, bolt11
      FROM "Withdrawl"
      WHERE "userId" IN (SELECT id FROM users WHERE "autoDropBolt11s")
      AND now() > created_at + ${retention}::INTERVAL
      AND hash IS NOT NULL
      AND status IS NOT NULL
    ), updated_rows AS (
      UPDATE "Withdrawl"
      SET hash = NULL, bolt11 = NULL, preimage = NULL
      FROM to_be_updated
      WHERE "Withdrawl".id = to_be_updated.id)
    SELECT * FROM to_be_updated;`

  if (invoices.length > 0) {
    for (const invoice of invoices) {
      try {
        await deletePayment({ id: invoice.hash, lnd })
      } catch (error) {
        console.error(`Error removing invoice with hash ${invoice.hash}:`, error)
        await models.withdrawl.update({
          where: { id: invoice.id },
          data: { hash: invoice.hash, bolt11: invoice.bolt11, preimage: invoice.preimage }
        })
      }
    }
  }
}

// The callback subscriptions above will NOT get called for JIT invoices that are already paid.
// So we manually cancel the HODL invoice here if it wasn't settled by user action
export async function finalizeHodlInvoice ({ data: { hash }, models, lnd, boss, ...args }) {
  const inv = await getInvoice({ id: hash, lnd })
  if (inv.is_confirmed) {
    return
  }

  const dbInv = await models.invoice.findUnique({
    where: { hash },
    include: {
      invoiceForward: {
        include: {
          withdrawl: true,
          wallet: true
        }
      }
    }
  })
  if (!dbInv) {
    console.log('invoice not found in database', hash)
    return
  }

  // if this is an actionType we need to cancel conditionally
  if (dbInv.actionType) {
    await paidActionCanceling({ data: { invoiceId: dbInv.id, invoice: inv }, models, lnd, boss })
  } else {
    await cancelHodlInvoice({ id: hash, lnd })
  }

  // sync LND invoice status with invoice status in database
  await checkInvoice({ data: { hash }, models, lnd, boss })

  return dbInv
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
