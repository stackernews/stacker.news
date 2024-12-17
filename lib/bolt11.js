/* eslint-disable camelcase */
import { payViaPaymentRequest, parsePaymentRequest } from 'ln-service'

export function isBolt11 (request) {
  return request.startsWith('lnbc') || request.startsWith('lntb') || request.startsWith('lntbs') || request.startsWith('lnbcrt')
}

export async function parseBolt11 ({ request }) {
  if (!isBolt11(request)) throw new Error('not a bolt11 invoice')
  return parsePaymentRequest({ request })
}

export async function payBolt11 ({ lnd, request, max_fee, ...args }) {
  if (!isBolt11(request)) throw new Error('not a bolt11 invoice')
  return payViaPaymentRequest({
    lnd,
    request,
    max_fee,
    ...args
  })
}
