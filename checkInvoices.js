const { PrismaClient } = require('@prisma/client')
const { authenticatedLndGrpc, getInvoice } = require('ln-service')
const dotenv = require('dotenv')
const serialize = require('./api/resolvers/serial')

dotenv.config({ path: '.' })

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

// 2. check all pending invoices from db in lnd
async function checkPendingInvoices () {
  // invoices
  const active = await models.invoice.findMany({
    where: {
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

checkPendingInvoices()
