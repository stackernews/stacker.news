/* eslint-disable camelcase */

import { payViaBolt12PaymentRequest, parseBolt12Request } from '@/lib/lndk'

export function isBolt12Offer (invoice) {
  return invoice.startsWith('lno1')
}

export function isBolt12Invoice (invoice) {
  return invoice.startsWith('lni1')
}

export function isBolt12 (invoice) {
  return isBolt12Offer(invoice) || isBolt12Invoice(invoice)
}

export async function payBolt12 ({ lnd, request: invoice, max_fee }) {
  if (!isBolt12Invoice(invoice)) throw new Error('not a bolt12 invoice')
  return await payViaBolt12PaymentRequest({ lnd, request: invoice, max_fee })
}

export function parseBolt12 ({ lnd, request: invoice }) {
  if (!isBolt12Invoice(invoice)) throw new Error('not a bolt12 request')
  return parseBolt12Request({ lnd, request: invoice })
}
