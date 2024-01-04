import serialize from '../api/resolvers/serial.js'
import { getInvoice, getPayment, cancelHodlInvoice } from 'ln-service'
import { datePivot } from '../lib/time.js'
import { sendUserNotification } from '../api/webPush/index.js'
import { msatsToSats, numWithUnits } from '../lib/format'
import { INVOICE_RETENTION_DAYS } from '../lib/constants'

const walletOptions = { startAfter: 5, retryLimit: 21, retryBackoff: true }

// TODO this should all be done via websockets
export async function checkInvoice ({ data: { hash, isHeldSet, sub }, boss, models, lnd }) {
  const isPoll = !sub
  let inv
  try {
    inv = await getInvoice({ id: hash, lnd })
  } catch (err) {
    console.log(err, hash)
    // on lnd related errors, we manually retry so we don't exponentially backoff
    await boss.send('checkInvoice', { hash }, walletOptions)
    return
  }
  console.log(inv)

  // check if invoice still exists since HODL invoices get deleted after usage
  const dbInv = await models.invoice.findUnique({ where: { hash } })
  if (!dbInv) return

  const expired = new Date(inv.expires_at) <= new Date()

  if (inv.is_confirmed && !inv.is_held) {
    // never mark hodl invoices as confirmed here because
    // we manually confirm them when we settle them
    await serialize(models,
      models.$executeRaw`SELECT confirm_invoice(${inv.id}, ${Number(inv.received_mtokens)})`,
      models.invoice.update({ where: { hash }, data: { confirmedIndex: inv.confirmed_index } })
    )
    if (sub) {
      // only send push notifications in the context of a LND subscription.
      // else, when this code is run from polling context, we would send another push notification.
      sendUserNotification(dbInv.userId, {
        title: `${numWithUnits(msatsToSats(inv.received_mtokens), { abbreviate: false })} were deposited in your account`,
        body: dbInv.comment || undefined,
        tag: 'DEPOSIT',
        data: { sats: msatsToSats(inv.received_mtokens) }
      }).catch(console.error)
    }
    // only schedule nip57 from polling context
    return sub ? null : boss.send('nip57', { hash })
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

  if (inv.is_held && !isHeldSet) {
    // this is basically confirm_invoice without setting confirmed_at since it's not settled yet
    // and without setting the user balance since that's done inside the same tx as the HODL invoice action.
    await serialize(models,
      models.invoice.update({ where: { hash }, data: { msatsReceived: Number(inv.received_mtokens), isHeld: true, confirmedIndex: inv.confirmed_index } }))
    // remember that we already executed this if clause
    // (even though the query above is idempotent but imo, this makes the flow more clear)
    isHeldSet = true
  }

  if (!expired && isPoll) {
    // recheck in 5 seconds if the invoice is younger than 5 minutes
    // otherwise recheck in 60 seconds
    const startAfter = new Date(inv.created_at) > datePivot(new Date(), { minutes: -5 }) ? 5 : 60
    await boss.send('checkInvoice', { hash, isHeldSet }, { ...walletOptions, startAfter })
  }

  if (expired && inv.is_held) {
    await cancelHodlInvoice({ id: hash, lnd })
  }
}

export async function checkWithdrawal ({ data: { id, hash, sub }, boss, models, lnd }) {
  let wdrwl
  let notFound = false
  // function was called by pgboss if it wasn't called because we subscribed to outgoing payments
  const isPoll = !sub
  try {
    wdrwl = await getPayment({ id: hash, lnd })
  } catch (err) {
    console.log(err)
    if (err[1] === 'SentPaymentNotFound') {
      // withdrawal was not found by LND
      notFound = true
    } else {
      // on lnd related errors, we manually retry so we don't exponentially backoff
      if (isPoll) await boss.send('checkWithdrawal', { id, hash }, walletOptions)
      return
    }
  }

  if (!id) {
    // no id provided. this is the case if this function was called via LND subscription: fetch id from database via hash

    // sanity check
    if (isPoll) console.error('id not set during withdrawal status poll: this should NEVER be the case')

    const dbWdrwl = await models.withdrawl.findFirst({ where: { hash } })
    if (!dbWdrwl) {
      // [WARNING] Withdrawal was not found in database!
      // This might be the case if we're subscribed to outgoing payments
      // but for some reason, LND paid an invoice that wasn't created via the SN GraphQL API.
      // >>> If this line ever gets hit, an adversary might be draining our funds right now <<<
      console.error('[warn] unexpected outgoing payment detected:', hash)
      // TODO: log this in Slack
      return
    }
    id = dbWdrwl.id
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
    }
    await serialize(models, models.$executeRaw`
      SELECT reverse_withdrawl(${id}::INTEGER, ${status}::"WithdrawlStatus")`)
  } else if (isPoll) {
    // TODO: remove requeuing when we fully switched to LND subscriptions.
    //   We won't need this anymore since any status update for outgoing payments will be handled using TrackPayments [0].
    //   However, we still need the worker+pgboss to check if payments got paid while the worker was down.
    //   [0] see https://lightning.engineering/api-docs/api/lnd/router/track-payments/index.html
    //   and https://www.npmjs.com/package/ln-service#subscribetopayments.
    const startAfter = new Date(wdrwl.created_at) > datePivot(new Date(), { minutes: -5 }) ? 5 : 60
    await boss.send('checkWithdrawal', { id, hash }, { ...walletOptions, startAfter })
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
