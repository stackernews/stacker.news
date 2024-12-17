/* eslint-disable camelcase */

import { payViaPaymentRequest, parsePaymentRequest } from 'ln-service'
import { estimateRouteFee } from '@/api/lnd'

import { payViaBolt12PaymentRequest, parseBolt12Request, estimateBolt12RouteFee } from '@/lib/lndk'

export function isBolt11 (request) {
  return request.startsWith('lnbc') || request.startsWith('lntb') || request.startsWith('lntbs') || request.startsWith('lnbcrt')
}

export function parseBolt11 ({ request }) {
  if (!isBolt11(request)) throw new Error('not a bolt11 invoice')
  return parsePaymentRequest({ request })
}

export function payBolt11 ({ lnd, request, max_fee, ...args }) {
  if (!isBolt11(request)) throw new Error('not a bolt11 invoice')

  return payViaPaymentRequest({
    lnd,
    request,
    max_fee,
    ...args
  })
}

export function isBolt12Offer (invoice) {
  return invoice.startsWith('lno1')
}

export function isBolt12Invoice (invoice) {
  console.log('isBolt12Invoice', invoice)
  console.trace()
  return invoice.startsWith('lni1')
}

export async function payBolt12 ({ lnd, request: invoice, max_fee }) {
  if (!isBolt12Invoice(invoice)) throw new Error('not a bolt12 invoice')

  if (!invoice) throw new Error('No invoice in bolt12, please use prefetchBolt12Invoice')
  return await payViaBolt12PaymentRequest({ lnd, request: invoice, max_fee })
}

export function parseBolt12 ({ lnd, request: invoice }) {
  if (!isBolt12Invoice(invoice)) throw new Error('not a bolt12 request')
  return parseBolt12Request({ lnd, request: invoice })
}

export async function payInvoice ({ lnd, request: invoice, max_fee, ...args }) {
  if (isBolt12Invoice(invoice)) {
    return await payBolt12({ lnd, request: invoice, max_fee, ...args })
  } else {
    return await payBolt11({ lnd, request: invoice, max_fee, ...args })
  }
}

export async function parseInvoice ({ lnd, request }) {
  if (isBolt12Invoice(request)) {
    return await parseBolt12({ lnd, request })
  } else {
    return await parseBolt11({ request })
  }
}

export async function estimateFees ({ lnd, destination, tokens, mtokens, request, timeout }) {
  if (isBolt12Invoice(request)) {
    return await estimateBolt12RouteFee({ lnd, destination, tokens, mtokens, request, timeout })
  } else {
    return await estimateRouteFee({ lnd, destination, tokens, request, mtokens, timeout })
  }
}
