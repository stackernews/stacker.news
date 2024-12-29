/* eslint-disable camelcase */
import { payViaPaymentRequest, parsePaymentRequest } from 'ln-service'
import { isBolt11 } from '@/lib/bolt/bolt11-tags'
export { isBolt11 }

export async function parseBolt11 ({ request }) {
  if (!isBolt11(request)) throw new Error('not a bolt11 invoice')
  return parsePaymentRequest({ request })
}

export async function payBolt11 ({ lnd, request, max_fee, max_fee_mtokens, ...args }) {
  if (!isBolt11(request)) throw new Error('not a bolt11 invoice')
  return payViaPaymentRequest({
    lnd,
    request,
    max_fee,
    max_fee_mtokens,
    ...args
  })
}
