import { fetchBolt12InvoiceFromOffer } from '@/lib/lndk'
import { parseInvoice } from '@/lib/boltInvoices'
import { toPositiveNumber } from '@/lib/format'
export * from '@/wallets/bolt12'

export async function testCreateInvoice ({ offer }, { lnd }) {
  const invoice = await fetchBolt12InvoiceFromOffer({ lnd, offer, msats: 1000, description: 'test' })
  const parsedInvoice = await parseInvoice({ lnd, request: invoice })
  if (toPositiveNumber(parsedInvoice.mtokens) !== 1000) throw new Error('invalid invoice response')
  return offer
}

export async function createInvoice ({ msats, description, expiry }, { offer }, { lnd }) {
  const invoice = await fetchBolt12InvoiceFromOffer({ lnd, offer, msats, description })
  return invoice
}
