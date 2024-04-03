import serialize from '@/api/resolvers/serial.js'
import {
  getInvoice, getPayment, cancelHodlInvoice, deletePayment,
  subscribeToInvoices, subscribeToPayments, subscribeToInvoice
} from 'ln-service'
import { notifyDeposit, notifyWithdrawal } from '@/lib/webPush'
import { INVOICE_RETENTION_DAYS } from '@/lib/constants'
import { datePivot, sleep } from '@/lib/time.js'
import retry from 'async-retry'

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
          sub.then(sub => sub.on('error', reject))
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
        if (inv.secret) {
          logEvent('invoice_updated', inv)
          await checkInvoice({ data: { hash: inv.id }, ...args })
        } else {
          // this is a HODL invoice. We need to use SubscribeToInvoice which has is_held transitions
          // https://api.lightning.community/api/lnd/invoices/subscribe-single-invoice
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

  // check pending deposits as a redundancy in case we failed to record
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
        // record the is_held transition
        if (inv.is_held) {
          await checkInvoice({ data: { hash: inv.id }, ...args })
          // after that we can stop listening for updates
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

async function checkInvoice ({ data: { hash }, boss, models, lnd }) {
  const inv = await getInvoice({ id: hash, lnd })

  // invoice could be created by LND but wasn't inserted into the database yet
  // this is expected and the function will be called again with the updates
  const dbInv = await models.invoice.findUnique({ where: { hash } })
  if (!dbInv) {
    console.log('invoice not found in database', hash)
    return
  }

  if (inv.is_confirmed) {
    // NOTE: confirm invoice prevents double confirmations (idempotent)
    // ALSO: is_confirmed and is_held are mutually exclusive
    // that is, a hold invoice will first be is_held but not is_confirmed
    // and once it's settled it will be is_confirmed but not is_held
    const [[{ confirm_invoice: code }]] = await serialize(models,
      models.$queryRaw`SELECT confirm_invoice(${inv.id}, ${Number(inv.received_mtokens)})`,
      models.invoice.update({ where: { hash }, data: { confirmedIndex: inv.confirmed_index } })
    )

    // don't send notifications for JIT invoices
    if (dbInv.preimage) return
    if (code === 0) {
      notifyDeposit(dbInv.userId, { comment: dbInv.comment, ...inv })
    }

    return await boss.send('nip57', { hash })
  }

  if (inv.is_held) {
    // First query makes sure that after payment, JIT invoices are settled
    // within 60 seconds or they will be canceled to minimize risk of
    // force closures or wallets banning us.
    // Second query is basically confirm_invoice without setting confirmed_at
    // and without setting the user balance
    // those will be set when the invoice is settled by user action
    const expiresAt = new Date(Math.min(dbInv.expiresAt, datePivot(new Date(), { seconds: 60 })))
    return await serialize(models,
      models.$queryRaw`
      INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
      VALUES ('finalizeHodlInvoice', jsonb_build_object('hash', ${hash}), 21, true, ${expiresAt})`,
      models.invoice.update({
        where: { hash },
        data: {
          msatsReceived: Number(inv.received_mtokens),
          expiresAt,
          isHeld: true
        }
      }))
  }

  if (inv.is_canceled) {
    return await serialize(models,
      models.invoice.update({
        where: {
          hash: inv.id
        },
        data: {
          cancelled: true
        }
      }))
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

    return sub
  })

  // check pending withdrawals since they might have been paid while worker was down
  await checkPendingWithdrawals(args)
}

async function checkWithdrawal ({ data: { hash }, boss, models, lnd }) {
  const dbWdrwl = await models.withdrawl.findFirst({ where: { hash, status: null } })
  if (!dbWdrwl) {
    // [WARNING] LND paid an invoice that wasn't created via the SN GraphQL API.
    // >>> an adversary might be draining our funds right now <<<
    console.error('unexpected outgoing payment detected:', hash)
    // TODO: log this in Slack
    return
  }

  let wdrwl
  let notFound = false
  try {
    wdrwl = await getPayment({ id: hash, lnd })
  } catch (err) {
    if (err[1] === 'SentPaymentNotFound') {
      notFound = true
    } else {
      console.error('error getting payment', err)
      return
    }
  }

  if (wdrwl?.is_confirmed) {
    const fee = Number(wdrwl.payment.fee_mtokens)
    const paid = Number(wdrwl.payment.mtokens) - fee
    const [{ confirm_withdrawl: code }] = await serialize(models, models.$queryRaw`
      SELECT confirm_withdrawl(${dbWdrwl.id}::INTEGER, ${paid}, ${fee})`)
    if (code === 0) {
      notifyWithdrawal(dbWdrwl.userId, wdrwl)
    }
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

    await serialize(models,
      models.$executeRaw`
        SELECT reverse_withdrawl(${dbWdrwl.id}::INTEGER, ${status}::"WithdrawlStatus")`
    )
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
      AND now() > created_at + interval '${retention}'
      AND hash IS NOT NULL
    ), updated_rows AS (
      UPDATE "Withdrawl"
      SET hash = NULL, bolt11 = NULL
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
          data: { hash: invoice.hash, bolt11: invoice.bolt11 }
        })
      }
    }
  }
}

// The callback subscriptions above will NOT get called for JIT invoices that are already paid.
// So we manually cancel the HODL invoice here if it wasn't settled by user action
export async function finalizeHodlInvoice ({ data: { hash }, models, lnd, ...args }) {
  const inv = await getInvoice({ id: hash, lnd })
  if (inv.is_confirmed) {
    return
  }

  await cancelHodlInvoice({ id: hash, lnd })

  // sync LND invoice status with invoice status in database
  await checkInvoice({ data: { hash }, models, lnd, ...args })
}

export async function checkPendingDeposits (args) {
  const { models } = args
  const pendingDeposits = await models.invoice.findMany({ where: { confirmedAt: null, cancelled: false } })
  for (const d of pendingDeposits) {
    try {
      await checkInvoice({ data: { id: d.id, hash: d.hash }, ...args })
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
      await checkWithdrawal({ data: { id: w.id, hash: w.hash }, ...args })
      await sleep(10)
    } catch {
      console.error('error checking withdrawal', w.hash)
    }
  }
}
