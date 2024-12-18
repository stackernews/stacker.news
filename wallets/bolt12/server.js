import { withTimeout } from '@/lib/time'
import { fetchBolt12InvoiceFromOffer } from '@/lib/lndk'
import { isBolt12Invoice } from '@/lib/bolt12'
import { parseInvoice } from '@/lib/boltInvoices'
import { toPositiveNumber } from '@/lib/format'
export * from '@/wallets/bolt12'

export async function testCreateInvoice ({ offer }, { lnd }) {
  const timeout = 15_000
  return await withTimeout((async () => {
    const invoice = await fetchBolt12InvoiceFromOffer({ lnd, offer, msats: 1000, description: 'test' })
    if (!isBolt12Invoice(invoice)) throw new Error('not a bolt12 invoice')
    const parsedInvoice = await parseInvoice({ lnd, request: invoice })
    if (toPositiveNumber(parsedInvoice.mtokens) !== 1000) throw new Error('invalid invoice response')
    return offer
  })(), timeout)
}

export async function createInvoice ({ msats, description, expiry }, { offer }, { lnd }) {
  const invoice = await fetchBolt12InvoiceFromOffer({ lnd, offer, msats, description })
  return invoice
}
