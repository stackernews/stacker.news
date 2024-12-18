/* eslint-disable camelcase */
import { payBolt12, parseBolt12, isBolt12Invoice, isBolt12Offer } from './bolt12'
import { payBolt11, parseBolt11, isBolt11 } from './bolt11'
import { estimateBolt12RouteFee } from '@/lib/lndk'
import { estimateRouteFee } from '@/api/lnd'

export async function payInvoice ({ lnd, request: invoice, max_fee, max_fee_mtokens, ...args }) {
  if (isBolt12Invoice(invoice)) {
    return await payBolt12({ lnd, request: invoice, max_fee, max_fee_mtokens, ...args })
  } else if (isBolt11(invoice)) {
    return await payBolt11({ lnd, request: invoice, max_fee, max_fee_mtokens, ...args })
  } else if (isBolt12Offer(invoice)) {
    throw new Error('cannot pay bolt12 offer directly, please fetch a bolt12 invoice from the offer first')
  } else {
    throw new Error('unknown invoice type')
  }
}

export async function parseInvoice ({ lnd, request }) {
  if (isBolt12Invoice(request)) {
    return await parseBolt12({ lnd, request })
  } else if (isBolt11(request)) {
    return await parseBolt11({ request })
  } else if (isBolt12Offer(request)) {
    throw new Error('bolt12 offer instead of invoice, please fetch a bolt12 invoice from the offer first')
  } else {
    throw new Error('unknown invoice type')
  }
}

export async function estimateFees ({ lnd, destination, tokens, mtokens, request, timeout }) {
  if (isBolt12Invoice(request)) {
    return await estimateBolt12RouteFee({ lnd, destination, tokens, mtokens, request, timeout })
  } else if (isBolt11(request)) {
    return await estimateRouteFee({ lnd, destination, tokens, request, mtokens, timeout })
  } else if (isBolt12Offer(request)) {
    throw new Error('bolt12 offer instead of invoice, please fetch a bolt12 invoice from the offer first')
  } else {
    throw new Error('unknown invoice type')
  }
}
