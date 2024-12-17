/* eslint-disable camelcase */
import { payBolt12, parseBolt12, isBolt12Invoice } from './bolt12'
import { payBolt11, parseBolt11 } from './bolt11'
import { estimateBolt12RouteFee } from '@/lib/lndk'
import { estimateRouteFee } from '@/api/lnd'

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
