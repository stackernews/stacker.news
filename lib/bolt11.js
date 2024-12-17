/* eslint-disable camelcase */
import { payViaPaymentRequest, parsePaymentRequest } from 'ln-service'
import { bolt11InvoiceSchema } from './validate'

export function isBolt11 (request) {
  if (!request.startsWith('lnbc') && !request.startsWith('lntb') && !request.startsWith('lntbs') && !request.startsWith('lnbcrt')) return false
  bolt11InvoiceSchema.validateSync(request)
  return true
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
