/* eslint-disable camelcase */

import { payViaBolt12PaymentRequest, parseBolt12Request } from '@/lib/lndk'
import { bolt12OfferSchema, bolt12InvoiceSchema } from './validate'

export function isBolt12Offer (invoice) {
  if (!invoice.startsWith('lno1')) return false
  bolt12OfferSchema.validateSync(invoice)
  return true
}

export function isBolt12Invoice (invoice) {
  if (!invoice.startsWith('lni1')) return false
  bolt12InvoiceSchema.validateSync(invoice)
  return true
}

export function isBolt12 (invoice) {
  return isBolt12Offer(invoice) || isBolt12Invoice(invoice)
}

export async function payBolt12 ({ lnd, request: invoice, max_fee }) {
  if (!isBolt12Invoice(invoice)) throw new Error('not a bolt12 invoice')
  return await payViaBolt12PaymentRequest({ lnd, request: invoice, max_fee })
}

export async function parseBolt12 ({ lnd, request: invoice }) {
  if (!isBolt12Invoice(invoice)) throw new Error('not a bolt12 request')
  return await parseBolt12Request({ lnd, request: invoice })
}
