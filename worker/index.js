const PgBoss = require('pg-boss')
const dotenv = require('dotenv')
const serialize = require('../api/resolvers/serial')
const { PrismaClient } = require('@prisma/client')
const { authenticatedLndGrpc, getInvoice, getPayment } = require('ln-service')

dotenv.config({ path: '..' })

const boss = new PgBoss(process.env.DATABASE_URL)
const { lnd } = authenticatedLndGrpc({
  cert: process.env.LND_CERT,
  macaroon: process.env.LND_MACAROON,
  socket: process.env.LND_SOCKET
})
const models = new PrismaClient()
const walletOptions = { startAfter: 5, retryLimit: 21, retryBackoff: true }

boss.on('error', error => console.error(error))

async function work () {
  await boss.start()
  await boss.work('checkInvoice', checkInvoice)
  await boss.work('checkWithdrawal', checkWithdrawal)
  console.log('working jobs')
}

async function checkInvoice ({ data: { hash } }) {
  const inv = await getInvoice({ id: hash, lnd })
  console.log(inv)

  if (inv.is_confirmed) {
    await serialize(models,
      models.$executeRaw`SELECT confirm_invoice(${inv.id}, ${Number(inv.received_mtokens)})`)
  } else if (inv.is_canceled) {
    // mark as cancelled
    await serialize(models,
      models.invoice.update({
        where: {
          hash: inv.id
        },
        data: {
          cancelled: true
        }
      }))
  } else if (new Date(inv.expires_at) > new Date()) {
    // not expired, recheck in 5 seconds
    boss.send('checkInvoice', { hash }, walletOptions)
  }
}

async function checkWithdrawal ({ data: { id, hash } }) {
  let wdrwl
  let notFound = false
  try {
    wdrwl = await getPayment({ id: hash, lnd })
  } catch (err) {
    console.log(err)
    if (err[1] === 'SentPaymentNotFound') {
      notFound = true
    } else {
      throw err
    }
  }
  console.log(wdrwl)

  if (wdrwl?.is_confirmed) {
    const fee = Number(wdrwl.payment.fee_mtokens)
    const paid = Number(wdrwl.payment.mtokens) - fee
    await serialize(models, models.$executeRaw`
      SELECT confirm_withdrawl(${id}, ${paid}, ${fee})`)
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
      SELECT reverse_withdrawl(${id}, ${status})`)
  } else {
    // we need to requeue to check again in 5 seconds
    boss.send('checkWithdrawal', { id, hash }, walletOptions)
  }
}

work()
