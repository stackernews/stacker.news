/* eslint-disable camelcase */

import { payViaBolt12PaymentRequest, parseBolt12Request } from '@/lib/lndk'
import { isBolt12Invoice, isBolt12Offer, isBolt12 } from '@/lib/bolt12-info'
export { isBolt12Invoice, isBolt12Offer, isBolt12 }

export async function payBolt12 ({ lnd, request: invoice, max_fee, max_fee_mtokens }) {
  if (!isBolt12Invoice(invoice)) throw new Error('not a bolt12 invoice')
  return await payViaBolt12PaymentRequest({ lnd, request: invoice, max_fee, max_fee_mtokens })
}

export async function parseBolt12 ({ lnd, request: invoice }) {
  if (!isBolt12Invoice(invoice)) throw new Error('not a bolt12 request')
  return await parseBolt12Request({ lnd, request: invoice })
}
