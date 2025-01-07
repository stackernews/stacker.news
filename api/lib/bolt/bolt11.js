/* eslint-disable camelcase */
import { payViaPaymentRequest, parsePaymentRequest } from 'ln-service'
import { isBolt11 } from '@/lib/bolt/bolt11-tags'
import { estimateRouteFee } from '@/api/lnd'
export { isBolt11 }

export async function parseBolt11 ({ request }) {
  if (!isBolt11(request)) throw new Error('not a bolt11 invoice')
  return parsePaymentRequest({ request })
}

export async function payBolt11 ({ lnd, request, max_fee, max_fee_mtokens, ...args }) {
  if (!lnd) throw new Error('lnd required') // check if forgot to pass lnd
  if (!isBolt11(request)) throw new Error('not a bolt11 invoice')
  return payViaPaymentRequest({
    lnd,
    request,
    max_fee,
    max_fee_mtokens,
    ...args
  })
}

export async function estimateBolt11RouteFee ({ lnd, destination, tokens, mtokens, request, timeout }) {
  if (!lnd) throw new Error('lnd required') // check if forgot to pass lnd
  if (request && !isBolt11(request)) throw new Error('not a bolt11 request')
  return await estimateRouteFee({ lnd, destination, tokens, mtokens, request, timeout })
}
