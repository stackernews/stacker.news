import { cachedFetcher } from '@/lib/fetch'
import { toPositiveNumber } from '@/lib/validate'
import { authenticatedLndGrpc, getIdentity, getHeight, getWalletInfo, getNode } from 'ln-service'

const { lnd } = authenticatedLndGrpc({
  cert: process.env.LND_CERT,
  macaroon: process.env.LND_MACAROON,
  socket: process.env.LND_SOCKET
})

// Check LND GRPC connection
getWalletInfo({ lnd }, (err, result) => {
  if (err) {
    console.error('LND GRPC connection error')
    return
  }
  console.log('LND GRPC connection successful')
})

export async function estimateRouteFee ({ lnd, destination, tokens, mtokens, request, timeout }) {
  return await new Promise((resolve, reject) => {
    lnd.router.estimateRouteFee({
      dest: Buffer.from(destination, 'hex'),
      amt_sat: tokens ? toPositiveNumber(tokens) : toPositiveNumber(BigInt(mtokens) / BigInt(1e3)),
      payment_request: request,
      timeout
    }, (err, res) => {
      if (err) {
        reject(err)
        return
      }

      if (res?.failure_reason) {
        reject(new Error(`Unable to estimate route: ${res.failure_reason}`))
        return
      }

      if (res.routing_fee_msat < 0 || res.time_lock_delay <= 0) {
        reject(new Error('Unable to estimate route, excessive values: ' + JSON.stringify(res)))
        return
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

  if (withdrawal?.failed.is_insufficient_balance) {
    return {
      status: 'INSUFFICIENT_BALANCE',
      message: 'you didn\'t have enough sats'
    }
  } else if (withdrawal?.failed.is_invalid_payment) {
    return {
      status: 'INVALID_PAYMENT',
      message: 'invalid payment'
    }
  } else if (withdrawal?.failed.is_pathfinding_timeout) {
    return {
      status: 'PATHFINDING_TIMEOUT',
      message: 'no route found'
    }
  } else if (withdrawal?.failed.is_route_not_found) {
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
    const { identity } = await getIdentity({ lnd, ...args })
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

export default lnd
