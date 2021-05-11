const { PrismaClient } = require('@prisma/client')
const { authenticatedLndGrpc, subscribeToInvoices, getInvoice } = require('ln-service')
const dotenv = require('dotenv')

dotenv.config({ path: '..' })

const { lnd } = authenticatedLndGrpc({
  cert: process.env.LND_CERT,
  macaroon: process.env.LND_MACAROON,
  socket: process.env.LND_SOCKET
})

const models = new PrismaClient()

async function recordStatus (inv) {
  console.log(inv)
  if (inv.is_confirmed) {
    await models.$queryRaw`SELECT confirm_invoice(${inv.id}, ${Number(inv.received_mtokens)})`
  } else if (inv.is_canceled) {
    // mark as cancelled
    models.invoice.update({
      where: {
        hash: inv.id
      },
      data: {
        cancelled: true
      }
    })
  }
}

// 1. subscribe to all invoices async
const sub = subscribeToInvoices({ lnd })
sub.on('invoice_updated', recordStatus)

// 2. check all pending invoices from db in lnd
async function checkPending () {
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
      recordStatus(inv)
    } catch (error) {
      console.log(error)
      process.exit(1)
    }
  })
}

checkPending()
