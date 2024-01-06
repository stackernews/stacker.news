import serialize from '../api/resolvers/serial.js'
import { getInvoice, getPayment, cancelHodlInvoice, subscribeToInvoices, subscribeToPayments, subscribeToInvoice } from 'ln-service'
import { sendUserNotification } from '../api/webPush/index.js'
import { msatsToSats, numWithUnits } from '../lib/format'
import { INVOICE_RETENTION_DAYS } from '../lib/constants'

export async function lndSubscriptions (args) {
  subscribeToDeposits(args).catch(console.error)
  subscribeToWithdrawals(args).catch(console.error)
}

const logEvent = (name, args) => console.log(`event ${name} triggered with args`, args)
const logEventError = (name, error) => console.error(`error running ${name}`, error)

async function subscribeToDeposits (args) {
  const { models, lnd } = args

  const [lastConfirmed] = await models.$queryRaw`SELECT "confirmedIndex" FROM "Invoice" ORDER BY "confirmedIndex" DESC NULLS LAST LIMIT 1`

  // https://www.npmjs.com/package/ln-service#subscribetoinvoices
  const sub = subscribeToInvoices({ lnd, confirmed_after: lastConfirmed?.confirmedIndex })
  sub.on('invoice_updated', async (inv) => {
    if (!inv.secret) {
      // this is a HODL invoice. We need to use SubscribeToInvoice
      // to get all state transition since SubscribeToInvoices is only for invoice creation and settlement.
      // see https://api.lightning.community/api/lnd/invoices/subscribe-single-invoice
      //  vs https://api.lightning.community/api/lnd/lightning/subscribe-invoices
      return subscribeToHodlInvoice({ hash: inv.id, ...args }).catch(console.error)
    }
    logEvent('invoice_updated', inv)
    try {
      await checkInvoice({ data: { hash: inv.id }, ...args })
    } catch (error) {
      logEventError('invoice_updated', error)
    }
  })
  sub.on('error', console.error)

  // NOTE:
  //   This can be removed when all pending invoices that were created before we switched off polling ("pre-migration invoices") have finalized.
  //   This is one hour after deployment since that's when these invoices expire if they weren't paid already.
  //   This is required to sync the database with any invoice that was paid and thus will not trigger the callback of `subscribeToInvoices` anymore.
  //   For pre-migration invoices that weren't paid, we can rely on the LND subscription to trigger on updates.
  await checkPendingDeposits(args)
}

async function subscribeToHodlInvoice (args) {
  const { lnd, hash } = args
  let sub
  try {
    await new Promise((resolve, reject) => {
      // https://www.npmjs.com/package/ln-service#subscribetoinvoice
      sub = subscribeToInvoice({ id: hash, lnd })
      sub.on('invoice_updated', async (inv) => {
        logEvent('hodl_invoice_updated', inv)
        try {
          await checkInvoice({ data: { hash: inv.id }, ...args })
          // If invoice is canceled, the invoice was finalized and there will be no more updates for this HODL invoice.
          // On expiration, the callback will also get called with `is_canceled` set, so expiration is the same as cancelation.
          // However, the callback will NOT get called if the HODL invoice was already paid.
          // We run a job for this case to manually cancel the invoice if it wasn't settled yet.
          // That's why we can also stop listening for updates when the invoice was already paid (`is_held` set).
          if (inv.is_held || inv.is_canceled) {
            return resolve()
          }
        } catch (error) {
          logEventError('hodl_invoice_updated', error)
          reject(error)
        }
      })
      sub.on('error', reject)
    })
  } catch (error) {
    console.error(error)
  }
  sub?.removeAllListeners()
}

export async function finalizeHodlInvoice ({ data: { hash }, models, lnd }) {
  let inv
  try {
    inv = await getInvoice({ id: hash, lnd })
  } catch (err) {
    console.log(err, hash)
    return
  }
  if (!inv.is_confirmed) await cancelHodlInvoice({ id: hash, lnd })
}

async function subscribeToWithdrawals (args) {
  const { lnd } = args

  // https://www.npmjs.com/package/ln-service#subscribetopayments
  const sub = subscribeToPayments({ lnd })
  sub.on('confirmed', async (payment) => {
    logEvent('confirmed', payment)
    try {
      await checkWithdrawal({ data: { hash: payment.id }, ...args })
    } catch (error) {
      logEventError('confirmed', error)
    }
  })
  sub.on('failed', async (payment) => {
    logEvent('failed', payment)
    try {
      await checkWithdrawal({ data: { hash: payment.id }, ...args })
    } catch (error) {
      logEventError('failed', error)
    }
  })
  // ignore payment attempts
  sub.on('paying', (attempt) => {})
  sub.on('error', console.error)

  // check pending withdrawals since they might have been paid while worker was down.
  await checkPendingWithdrawals(args)
}

async function checkPendingWithdrawals (args) {
  const { models } = args
  const pendingWithdrawals = await models.withdrawl.findMany({ where: { status: null } })
  for (const w of pendingWithdrawals) {
    await checkWithdrawal({ data: { id: w.id, hash: w.hash }, ...args })
  }
}

async function checkPendingDeposits (args) {
  const { models } = args
  const pendingDeposits = await models.invoice.findMany({ where: { confirmedAt: null, cancelled: false } })
  for (const d of pendingDeposits) {
    await checkInvoice({ data: { id: d.id, hash: d.hash }, ...args })
  }
}

async function checkInvoice ({ data: { hash }, boss, models, lnd }) {
  let inv
  try {
    inv = await getInvoice({ id: hash, lnd })
  } catch (err) {
    console.log(err, hash)
    return
  }
  console.log(inv)

  // check if invoice exists since it might just have been created by LND and wasn't inserted into the database yet
  // but that is not a problem since this function will be called again with the update
  // FIXME: there might be a race condition here if the invoice gets paid before the invoice was inserted into the db.
  const dbInv = await models.invoice.findUnique({ where: { hash } })
  if (!dbInv) {
    console.log('invoice not found in database', hash)
    return
  }

  const expired = new Date(inv.expires_at) <= new Date()

  if (inv.is_confirmed && !inv.is_held) {
    // never mark hodl invoices as confirmed here because
    // we manually confirm them when we settle them
    await serialize(models,
      models.$executeRaw`SELECT confirm_invoice(${inv.id}, ${Number(inv.received_mtokens)})`,
      models.invoice.update({ where: { hash }, data: { confirmedIndex: inv.confirmed_index } })
    )
    sendUserNotification(dbInv.userId, {
      title: `${numWithUnits(msatsToSats(inv.received_mtokens), { abbreviate: false })} were deposited in your account`,
      body: dbInv.comment || undefined,
      tag: 'DEPOSIT',
      data: { sats: msatsToSats(inv.received_mtokens) }
    }).catch(console.error)
    return boss.send('nip57', { hash })
  }

  if (inv.is_canceled) {
    return serialize(models,
      models.invoice.update({
        where: {
          hash: inv.id
        },
        data: {
          cancelled: true
        }
      }))
  }

  if (inv.is_held) {
    // this is basically confirm_invoice without setting confirmed_at since it's not settled yet
    // and without setting the user balance since that's done inside the same tx as the HODL invoice action.
    await serialize(models,
      models.invoice.update({ where: { hash }, data: { msatsReceived: Number(inv.received_mtokens), isHeld: true, confirmedIndex: inv.confirmed_index } }))
  }

  if (expired && inv.is_held) {
    await cancelHodlInvoice({ id: hash, lnd })
  }
}

async function checkWithdrawal ({ data: { hash }, boss, models, lnd }) {
  const dbWdrwl = await models.withdrawl.findFirst({ where: { hash } })
  if (!dbWdrwl) {
    // [WARNING] Withdrawal was not found in database!
    // This might be the case if we're subscribed to outgoing payments
    // but for some reason, LND paid an invoice that wasn't created via the SN GraphQL API.
    // >>> If this line ever gets hit, an adversary might be draining our funds right now <<<
    console.error('unexpected outgoing payment detected:', hash)
    // TODO: log this in Slack
    return
  }
  const id = dbWdrwl.id
  let wdrwl
  let notFound = false

  try {
    wdrwl = await getPayment({ id: hash, lnd })
  } catch (err) {
    console.log(err)
    if (err[1] === 'SentPaymentNotFound') {
      // withdrawal was not found by LND
      notFound = true
    } else {
      return
    }
  }

  if (wdrwl?.is_confirmed) {
    const fee = Number(wdrwl.payment.fee_mtokens)
    const paid = Number(wdrwl.payment.mtokens) - fee
    await serialize(models, models.$executeRaw`
      SELECT confirm_withdrawl(${id}::INTEGER, ${paid}, ${fee})`)
  } else if (wdrwl?.is_failed || notFound) {
    let status = 'UNKNOWN_FAILURE'
    if (wdrwl?.failed.is_insufficient_balance) {
      status = 'INSUFFICIENT_BALANCE'
    } else if (wdrwl?.failed.is_invalid_payment) {
      status = 'INVALID_PAYMENT'
    } else if (wdrwl?.failed.is_pathfinding_timeout) {
      status = 'PATHFINDING_TIMEOUT'
    } else if (wdrwl?.failed.is_route_not_found) {
      status = 'ROUTE_NOT_FOUND'
    } else await serialize(models, models.$executeRaw`SELECT reverse_withdrawl(${id}::INTEGER, ${status}::"WithdrawlStatus")`)
  }
}

export async function autoDropBolt11s ({ models }) {
  await serialize(models, models.$executeRaw`
    UPDATE "Withdrawl"
    SET hash = NULL, bolt11 = NULL
    WHERE "userId" IN (SELECT id FROM users WHERE "autoDropBolt11s")
    AND now() > created_at + interval '${INVOICE_RETENTION_DAYS} days'
    AND hash IS NOT NULL;`
  )
}
