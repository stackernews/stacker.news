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
  await boss.work('repin-*', repin)
  await boss.work('trust', trust)
  console.log('working jobs')
}

async function trust () {
  return null
}

async function repin ({ name }) {
  console.log(name)
  // get the id
  const id = name.slice('repin-'.length)
  if (id.length === 0 || isNaN(id)) {
    console.log('repin id not found in', name)
    return
  }

  // get the latest item with this id
  const pinId = Number(id)
  const current = await models.item.findFirst(
    {
      where: {
        pinId
      },
      orderBy: {
        createdAt: 'desc'
      }
    }
  )

  if (!current) {
    console.log('could not find existing item for', name)
    return
  }

  // create a new item with matching 1) title, text, and url and 2) setting pinId
  await models.item.create({
    data: {
      title: current.title,
      text: current.text,
      url: current.url,
      userId: current.userId,
      pinId
    }
  })
}

async function checkInvoice ({ data: { hash } }) {
  let inv
  try {
    inv = await getInvoice({ id: hash, lnd })
  } catch (err) {
    console.log(err)
    // on lnd related errors, we manually retry which so we don't exponentially backoff
    await boss.send('checkInvoice', { hash }, walletOptions)
    return
  }
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
    await boss.send('checkInvoice', { hash }, walletOptions)
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
      // on lnd related errors, we manually retry which so we don't exponentially backoff
      await boss.send('checkWithdrawal', { id, hash }, walletOptions)
      return
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
    await boss.send('checkWithdrawal', { id, hash }, walletOptions)
  }
}

work()
