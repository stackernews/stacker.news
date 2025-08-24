import {
  getInvoice,
  subscribeToInvoices, subscribeToPayments, subscribeToInvoice
} from 'ln-service'
import { getPaymentOrNotSent } from '@/api/lnd'
import { sleep } from '@/lib/time'
import retry from 'async-retry'
import {
  payInWithdrawalPaid, payInWithdrawalFailed, payInPaid, payInForwarding, payInForwarded, payInFailedForward, payInHeld, payInFailed,
  PAY_IN_TERMINAL_STATES
} from '@/api/payIn/transitions'
import { isP2P, isWithdrawal } from '@/api/payIn/lib/is'

export async function subscribeToBolt11s (args) {
  await subscribeToPayInBolt11s(args)
  await subscribeToPayOutBolt11s(args)
}

// lnd subscriptions can fail, so they need to be retried
function subscribeForever (subscribe) {
  retry(async bail => {
    let sub
    try {
      return await new Promise((resolve, reject) => {
        sub = subscribe(resolve, reject)
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
      console.error('error subscribing', error)
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

async function subscribeToPayInBolt11s (args) {
  const { models, lnd } = args

  subscribeForever(async () => {
    const [lastConfirmed] = await models.$queryRaw`
    SELECT "confirmedIndex"
    FROM "PayInBolt11"
    ORDER BY "confirmedIndex" DESC NULLS LAST
    LIMIT 1`
    const sub = subscribeToInvoices({ lnd, confirmed_after: lastConfirmed?.confirmedIndex })

    sub.on('invoice_updated', async (inv) => {
      try {
        logEvent('invoice_updated', inv)
        if (inv.secret) {
          // subscribeToInvoices only returns when added or settled
          await checkPayInBolt11({ data: { hash: inv.id, invoice: inv }, ...args })
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
  await checkPendingPayInBolt11s(args)
}

function subscribeToHodlInvoice (args) {
  const { lnd, hash } = args

  subscribeForever((resolve, reject) => {
    const sub = subscribeToInvoice({ id: hash, lnd })

    sub.on('invoice_updated', async (inv) => {
      logEvent('hodl_invoice_updated', inv)
      try {
        await checkPayInBolt11({ data: { hash: inv.id, invoice: inv }, ...args })
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
export async function checkPayInBolt11 ({ data: { hash, invoice }, boss, models, lnd }) {
  const inv = invoice ?? await getInvoice({ id: hash, lnd })

  console.log('inv', inv.id, 'is_confirmed', inv.is_confirmed, 'is_held', inv.is_held, 'is_canceled', inv.is_canceled)

  // invoice could be created by LND but wasn't inserted into the database yet
  // this is expected and the function will be called again with the updates
  const payIn = await models.payIn.findFirst({
    where: { payInBolt11: { hash } },
    include: {
      payInBolt11: true,
      payOutBolt11: true
    }
  })
  if (!payIn) {
    console.log('invoice not found in database', hash)
    return
  }

  if (inv.is_confirmed) {
    return await payInPaid({ data: { payInId: payIn.id, invoice: inv }, models, lnd, boss })
  }

  if (inv.is_held) {
    if (payIn.payOutBolt11) {
      if (payIn.payInState === 'PENDING_HELD') {
        return await payInForwarding({ data: { payInId: payIn.id, invoice: inv }, models, lnd, boss })
      }
      // transitions after held are dependent on the withdrawl status
      return await checkPayOutBolt11({ data: { hash, invoice: inv }, models, lnd, boss })
    }
    return await payInHeld({ data: { payInId: payIn.id, invoice: inv }, models, lnd, boss })
  }

  if (inv.is_canceled) {
    return await payInFailed({ data: { payInId: payIn.id, invoice: inv }, models, lnd, boss })
  }
}

async function subscribeToPayOutBolt11s (args) {
  const { lnd } = args

  // https://www.npmjs.com/package/ln-service#subscribetopayments
  subscribeForever(() => {
    const sub = subscribeToPayments({ lnd })

    sub.on('confirmed', async (payment) => {
      logEvent('confirmed', payment)
      try {
        // see https://github.com/alexbosworth/lightning/blob/ddf1f214ebddf62e9e19fd32a57fbeeba713340d/lnd_methods/offchain/subscribe_to_payments.js
        const withdrawal = { payment, is_confirmed: true }
        await checkPayOutBolt11({ data: { hash: payment.id, withdrawal }, ...args })
      } catch (error) {
        logEventError('confirmed', error)
      }
    })

    sub.on('failed', async (payment) => {
      logEvent('failed', payment)
      try {
        // see https://github.com/alexbosworth/lightning/blob/ddf1f214ebddf62e9e19fd32a57fbeeba713340d/lnd_methods/offchain/subscribe_to_payments.js
        const withdrawal = { failed: payment, is_failed: true }
        await checkPayOutBolt11({ data: { hash: payment.id, withdrawal }, ...args })
      } catch (error) {
        logEventError('failed', error)
      }
    })

    return sub
  })

  // check pending withdrawals since they might have been paid while worker was down
  await checkPendingPayOutBolt11s(args)
}

// if we already have the payment from a subscription event or previous call,
// we can skip a getPayment call
export async function checkPayOutBolt11 ({ data: { hash, withdrawal, invoice }, boss, models, lnd }) {
  // get the withdrawl if pending or it's an invoiceForward
  const payIn = await models.payIn.findFirst({
    where: {
      payOutBolt11: { hash },
      payInState: { notIn: PAY_IN_TERMINAL_STATES }
    },
    include: {
      payOutBolt11: true
    }
  })

  // nothing to do if the withdrawl is already recorded and it isn't an invoiceForward
  if (!payIn) return

  // TODO: I'm not sure notSent is accurate given that payOutBolt11 is created when the payIn is created
  const wdrwl = withdrawal ?? await getPaymentOrNotSent({ id: hash, lnd, createdAt: payIn.payOutBolt11.createdAt })

  console.log('wdrwl', hash, 'is_confirmed', wdrwl?.is_confirmed, 'is_failed', wdrwl?.is_failed, 'notSent', wdrwl?.notSent)

  if (wdrwl?.is_confirmed) {
    if (payIn.payInState === 'FORWARDING') {
      return await payInForwarded({ data: { payInId: payIn.id, withdrawal: wdrwl, invoice }, models, lnd, boss })
    }

    return await payInWithdrawalPaid({ data: { payInId: payIn.id, withdrawal: wdrwl }, models, lnd, boss })
  } else if (wdrwl?.is_failed || wdrwl?.notSent) {
    if (isWithdrawal(payIn)) {
      return await payInWithdrawalFailed({ data: { payInId: payIn.id, withdrawal: wdrwl }, models, lnd, boss })
    }

    // TODO: if can properly handle afterBegin failures, this can be removed
    if (payIn.payInState === 'PENDING_INVOICE_WRAP') {
      return await payInFailed({ data: { payInId: payIn.id, withdrawal: wdrwl, invoice }, models, lnd, boss })
    }

    return await payInFailedForward({ data: { payInId: payIn.id, withdrawal: wdrwl, invoice }, models, lnd, boss })
  }
}

export async function checkPendingPayInBolt11s (args) {
  const { models } = args
  const pendingPayIns = await models.payIn.findMany({
    where: {
      payInState: { notIn: PAY_IN_TERMINAL_STATES },
      payInBolt11: { isNot: null }
    },
    include: { payInBolt11: true }
  })

  for (const payIn of pendingPayIns) {
    try {
      await checkPayInBolt11({ ...args, data: { hash: payIn.payInBolt11.hash } })
      await sleep(10)
    } catch (err) {
      console.error('error checking invoice', payIn.payInBolt11.hash, err)
    }
  }
}

export async function checkPendingPayOutBolt11s (args) {
  const { models } = args
  const pendingPayOuts = await models.payIn.findMany({
    where: {
      payInState: { notIn: PAY_IN_TERMINAL_STATES },
      payOutBolt11: { isNot: null }
    },
    include: { payOutBolt11: true }
  })

  for (const payIn of pendingPayOuts) {
    try {
      await checkPayOutBolt11({ ...args, data: { hash: payIn.payOutBolt11.hash } })
      await sleep(10)
    } catch (err) {
      console.error('error checking withdrawal', payIn.payOutBolt11.hash, err)
    }
  }
}
