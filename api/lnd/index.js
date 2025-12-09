import { cachedFetcher } from '@/lib/fetch'
import { toPositiveNumber } from '@/lib/format'
import { authenticatedLndGrpc } from '@/lib/lnd'
import { randomBytes } from 'crypto'
import { chanNumber } from 'bolt07'
import { getIdentity, getHeight, getWalletInfo, getNode, getPayment, parsePaymentRequest } from 'ln-service'

const lnd = global.lnd || authenticatedLndGrpc({
  cert: process.env.LND_CERT,
  macaroon: process.env.LND_MACAROON,
  socket: process.env.LND_SOCKET
}).lnd

if (process.env.NODE_ENV === 'development') global.lnd = lnd

// Check LND GRPC connection
getWalletInfo({ lnd }, (err, result) => {
  if (err) {
    console.error('LND GRPC connection error')
    return
  }
  console.log('LND GRPC connection successful')
})

// we don't use this because it doesn't solve https://github.com/lightningnetwork/lnd/discussions/10427
// due to this bug, real probes cause the channel to be marked as unusable and the real payment fails
// this should be useful in the future though when need more control over probing
export async function rawProbePayment ({ lnd, request, maxFeeMsat, timeoutSeconds, maxCltvDelta }) {
  if (!request) {
    throw new Error('Payment request is required')
  }
  const inv = parsePaymentRequest({ request })
  const params = {
    allow_self_payment: true,
    amt_msat: inv.mtokens,
    cancelable: true,
    cltv_limit: maxCltvDelta,
    dest: Buffer.from(inv.destination, 'hex'),
    dest_custom_records: undefined,
    dest_features: inv.features.map(n => n.bit),
    fee_limit_msat: maxFeeMsat,
    final_cltv_delta: inv.cltv_delta,
    last_hop_pubkey: undefined,
    max_parts: 1,
    max_shard_size_msat: undefined,
    no_inflight_updates: true,
    outgoing_chan_id: undefined,
    outgoing_chan_ids: [],
    payment_addr: Buffer.from(inv.payment, 'hex'),
    payment_hash: randomBytes(32),
    payment_request: undefined,
    route_hints: inv.routes?.map(r => ({
      hop_hints: r.slice(1).map((h, i) => ({
        fee_base_msat: h.base_fee_mtokens,
        fee_proportional_millionths: h.fee_rate,
        chan_id: chanNumber({ channel: h.channel }).number,
        cltv_expiry_delta: h.cltv_delta,
        node_id: r[i].public_key
      }))
    })) ?? [],
    time_pref: 1,
    timeout_seconds: timeoutSeconds
  }
  return await new Promise((resolve, reject) => {
    const sub = lnd.router.sendPaymentV2(params)
    sub.on('data', (res) => {
      resolve(res)
    })
    sub.on('error', (err) => {
      reject(err)
    })
    sub.on('end', () => {
      reject(new Error('Payment timed out'))
    })
  })
}

export async function estimateRouteFee ({ lnd, destination, tokens, mtokens, request, timeout }) {
  // if the payment request includes us as route hint, we needd to use the destination and amount
  // otherwise, this will fail with a self-payment error
  if (request) {
    const inv = parsePaymentRequest({ request })
    const ourPubkey = await getOurPubkey({ lnd })
    if (Array.isArray(inv.routes)) {
      for (const route of inv.routes) {
        if (Array.isArray(route)) {
          for (const hop of route) {
            if (hop.public_key === ourPubkey) {
              console.log('estimateRouteFee ignoring self-payment route')
              request = false
              break
            }
          }
        }
      }
    }
    // XXX we don't use the payment request anymore because it causes the channel to be marked as unusable
    // and the real payment fails see: https://github.com/lightningnetwork/lnd/discussions/10427
    // without the request, the estimate is a statistical estimate based on past payments
    request = false
  }

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

  if (withdrawal?.failed?.is_insufficient_balance) {
    return {
      status: 'INSUFFICIENT_BALANCE',
      message: 'you didn\'t have enough sats'
    }
  } else if (withdrawal?.failed?.is_invalid_payment) {
    return {
      status: 'INVALID_PAYMENT',
      message: 'invalid payment'
    }
  } else if (withdrawal?.failed?.is_pathfinding_timeout) {
    return {
      status: 'PATHFINDING_TIMEOUT',
      message: 'no route found'
    }
  } else if (withdrawal?.failed?.is_route_not_found) {
    return {
      status: 'ROUTE_NOT_FOUND',
      message: 'no route found'
    }
  }

  return {
    status: 'UNKNOWN_FAILURE',
    message: 'unknown failure'
  }
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

export default lnd
