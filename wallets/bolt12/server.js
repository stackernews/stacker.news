import { fetchBolt12InvoiceFromOffer } from '@/api/lib/lndk'
import { parseInvoice } from '@/api/lib/bolt'
import { toPositiveNumber } from '@/lib/format'
export * from '@/wallets/bolt12'

export async function testCreateInvoice ({ offer }, { lnd, lndk }) {
  const invoice = await fetchBolt12InvoiceFromOffer({ lnd, lndk, offer, msats: 1000, description: 'test' })
  const parsedInvoice = await parseInvoice({ lnd, lndk, request: invoice })
  if (toPositiveNumber(parsedInvoice.mtokens) !== 1000) throw new Error('invalid invoice response')
  return offer
}

export async function createInvoice ({ msats, description, expiry }, { offer }, { lnd, lndk }) {
  const invoice = await fetchBolt12InvoiceFromOffer({ lnd, lndk, offer, msats, description })
  return invoice
}
