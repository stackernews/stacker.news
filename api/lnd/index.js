import { cachedFetcher } from '@/lib/fetch'
import { toPositiveNumber } from '@/lib/format'
import { authenticatedLndGrpc } from '@/lib/lnd'
import { getPayOutBolt11FailureDetail } from '@/lib/pay-in'
import {
  getIdentity, getHeight, getWalletInfo, getNode, getPayment,
  payViaPaymentRequest as lndPayViaPaymentRequest
} from 'ln-service'
import { assertLndAvailable, isLndMaintenance } from './maintenance'

const lnd = isLndMaintenance()
  ? undefined
  : global.lnd || authenticatedLndGrpc({
    cert: process.env.LND_CERT,
    macaroon: process.env.LND_MACAROON,
    socket: process.env.LND_SOCKET
  }).lnd

if (process.env.NODE_ENV === 'development' && lnd) global.lnd = lnd

if (lnd) {
  // Check LND GRPC connection
  getWalletInfo({ lnd }, (err, result) => {
    if (err) {
      console.error('LND GRPC connection error')
      return
    }
    console.log('LND GRPC connection successful')
  })
}

// Decode with the singleton LND that will pay the invoice. This is deliberately
// only an RPC-shape adapter: LND and protobuf are authoritative for validity.
export async function decodePaymentRequest ({ request }) {
  assertLndAvailable()
  if (!lnd?.default?.decodePayReq) throw new Error('LND does not support payment request decoding')

  const decoded = await new Promise((resolve, reject) => {
    lnd.default.decodePayReq({ pay_req: request }, (err, response) => {
      if (err) return reject(err)
      if (!response) return reject(new Error('LND returned no decoded payment request'))
      resolve(response)
    })
  })

  const createdAtMs = Number(decoded.timestamp) * 1000
  const expiresAtMs = createdAtMs + Number(decoded.expiry) * 1000

  return {
    cltv_delta: Number(decoded.cltv_expiry) || undefined,
    description: decoded.description,
    description_hash: decoded.description_hash || undefined,
    destination: decoded.destination,
    expires_at: new Date(expiresAtMs).toISOString(),
    features: Object.keys(decoded.features).map(bit => ({ bit: Number(bit) })),
    id: decoded.payment_hash,
    mtokens: String(decoded.num_msat),
    payment_addr: decoded.payment_addr,
    route_hints: decoded.route_hints
  }
}

export async function estimateRouteFee ({ lnd, destination, tokens, mtokens, request, timeout }) {
  assertLndAvailable()
  return await new Promise((resolve, reject) => {
    const params = {}

    if (request) {
      console.log('estimateRouteFee using payment request')
      params.payment_request = request
    } else {
      console.log('estimateRouteFee using destination and amount')
      params.dest = Buffer.from(destination, 'hex')
      params.amt_sat = tokens ? toPositiveNumber(tokens) : toPositiveNumber(BigInt(mtokens) / BigInt(1e3))
    }

    lnd.router.estimateRouteFee({
      ...params,
      timeout
    }, (err, res) => {
      if (err) {
        return reject(err)
      }

      if (res.failure_reason !== 'FAILURE_REASON_NONE' || res.routing_fee_msat < 0 || res.time_lock_delay <= 0) {
        return reject(new Error(`Unable to estimate route: ${res.failure_reason}`))
      }

      resolve({
        routingFeeMsat: toPositiveNumber(res.routing_fee_msat),
        timeLockDelay: toPositiveNumber(res.time_lock_delay)
      })
    })
  })
}

// created_height is the accepted_height, timeout is the expiry height
// ln-service remaps the `htlcs` field of lookupInvoice to `payments` and
// see: https://github.com/alexbosworth/lightning/blob/master/lnd_responses/htlc_as_payment.js
// and: https://lightning.engineering/api-docs/api/lnd/lightning/lookup-invoice/index.html#lnrpcinvoicehtlc
export function hodlInvoiceCltvDetails (inv) {
  if (!inv.payments) {
    throw new Error('No payments found')
  }
  if (!inv.is_held) {
    throw new Error('Invoice is not held')
  }

  const acceptHeight = inv.payments.reduce((max, htlc) => {
    const createdHeight = toPositiveNumber(htlc.created_height)
    return createdHeight > max ? createdHeight : max
  }, 0)
  const expiryHeight = inv.payments.reduce((min, htlc) => {
    const timeout = toPositiveNumber(htlc.timeout)
    return timeout < min ? timeout : min
  }, Number.MAX_SAFE_INTEGER)

  return {
    expiryHeight: toPositiveNumber(expiryHeight),
    acceptHeight: toPositiveNumber(acceptHeight)
  }
}

export function getPaymentFailureStatus (withdrawal) {
  if (withdrawal && !withdrawal.is_failed) {
    throw new Error('withdrawal is not failed')
  }

  const failure = status => ({
    status,
    message: getPayOutBolt11FailureDetail(status).message
  })

  if (withdrawal?.failed?.is_insufficient_balance) {
    return failure('INSUFFICIENT_BALANCE')
  } else if (withdrawal?.failed?.is_invalid_payment) {
    return failure('INVALID_PAYMENT')
  } else if (withdrawal?.failed?.is_pathfinding_timeout) {
    return failure('PATHFINDING_TIMEOUT')
  } else if (withdrawal?.failed?.is_route_not_found) {
    return failure('ROUTE_NOT_FOUND')
  }

  return failure('UNKNOWN_FAILURE')
}

export const getBlockHeight = cachedFetcher(async function fetchBlockHeight ({ lnd, ...args }) {
  try {
    const { current_block_height: height } = await getHeight({ lnd, ...args })
    return height
  } catch (err) {
    throw new Error(`Unable to fetch block height: ${err.message}`)
  }
}, {
  maxSize: 1,
  cacheExpiry: 60 * 1000, // 1 minute
  forceRefreshThreshold: 5 * 60 * 1000, // 5 minutes
  keyGenerator: () => 'getHeight'
})

export const getOurPubkey = cachedFetcher(async function fetchOurPubkey ({ lnd, ...args }) {
  try {
    const identity = await getIdentity({ lnd, ...args })
    return identity.public_key
  } catch (err) {
    throw new Error(`Unable to fetch identity: ${err.message}`)
  }
}, {
  maxSize: 1,
  cacheExpiry: 0, // never expire
  forceRefreshThreshold: 0, // never force refresh
  keyGenerator: () => 'getOurPubkey'
})

export const getNodeSockets = cachedFetcher(async function fetchNodeSockets ({ lnd, ...args }) {
  try {
    return (await getNode({ lnd, is_omitting_channels: true, ...args }))?.sockets
  } catch (err) {
    throw new Error(`Unable to fetch node info: ${err.message}`)
  }
}, {
  maxSize: 100,
  cacheExpiry: 1000 * 60 * 60 * 24, // 1 day
  forceRefreshThreshold: 1000 * 60 * 60 * 24 * 7, // 1 week
  keyGenerator: (args) => {
    const { public_key: publicKey } = args
    return publicKey
  }
})

export async function getPaymentOrNotSent ({ id, lnd }) {
  assertLndAvailable()
  try {
    return await getPayment({ id, lnd })
  } catch (err) {
    if (err[1] === 'SentPaymentNotFound') {
      return { notSent: true, is_failed: true }
    } else {
      throw err
    }
  }
}

export async function payViaPaymentRequest (args) {
  assertLndAvailable()
  return await lndPayViaPaymentRequest(args)
}

export default lnd
