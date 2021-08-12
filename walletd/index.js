const { PrismaClient } = require('@prisma/client')
const { authenticatedLndGrpc, subscribeToInvoices, getInvoice, getPayment } = require('ln-service')
const dotenv = require('dotenv')
const serialize = require('../api/resolvers/serial')

dotenv.config({ path: '..' })

const { lnd } = authenticatedLndGrpc({
  cert: process.env.LND_CERT,
  macaroon: process.env.LND_MACAROON,
  socket: process.env.LND_SOCKET
})

const models = new PrismaClient()

async function recordInvoiceStatus (inv) {
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
  }
}

// 1. subscribe to all invoices async
const sub = subscribeToInvoices({ lnd })
sub.on('invoice_updated', recordInvoiceStatus)

// 2. check all pending invoices from db in lnd
async function checkPendingInvoices () {
  // invoices
  const now = new Date()
  const active = await models.invoice.findMany({
    where: {
      expiresAt: {
        gt: now
      },
      cancelled: false,
      confirmedAt: {
        equals: null
      }
    }
  })

  active.forEach(async invoice => {
    try {
      const inv = await getInvoice({ id: invoice.hash, lnd })
      await recordInvoiceStatus(inv)
    } catch (error) {
      console.log(invoice, error)
      process.exit(1)
    }
  })
}

async function recordWithdrawlStatus (id, wdrwl) {
  console.log(wdrwl)
  if (wdrwl.is_confirmed) {
    // mtokens also contains the fee?
    // is this true for getPayment?
    const fee = Number(wdrwl.payment.fee_mtokens)
    const paid = Number(wdrwl.mtokens) - fee
    await serialize(models, models.$executeRaw`
      SELECT confirm_withdrawl(${id}, ${paid}, ${fee})`)
  } else if (wdrwl.is_failed) {
    let status = 'UNKNOWN_FAILURE'
    if (wdrwl.failed.is_insufficient_balance) {
      status = 'INSUFFICIENT_BALANCE'
    } else if (wdrwl.failed.is_invalid_payment) {
      status = 'INVALID_PAYMENT'
    } else if (wdrwl.failed.is_pathfinding_timeout) {
      status = 'PATHFINDING_TIMEOUT'
    } else if (wdrwl.failed.is_route_not_found) {
      status = 'ROUTE_NOT_FOUND'
    }
    await serialize(models, models.$executeRaw`
      SELECT reverse_withdrawl(${id}, ${status})`)
  }
}

async function checkPendingWithdrawls () {
  // look for withdrawls that are 30 seconds old but don't have a status
  const leftovers = await models.withdrawl.findMany({
    where: {
      createdAt: {
        lt: new Date(new Date().setSeconds(new Date().getSeconds() - 30))
      },
      status: {
        equals: null
      }
    }
  })

  leftovers.forEach(async withdrawl => {
    try {
      const wdrwl = await getPayment({ id: withdrawl.hash, lnd })
      await recordWithdrawlStatus(withdrawl.id, wdrwl)
    } catch (error) {
      console.log(withdrawl, error)
      process.exit(1)
    }
  })

  // check withdrawls every 5 seconds
  setTimeout(checkPendingWithdrawls, 5000)
}

checkPendingInvoices()
checkPendingWithdrawls()
