import { toPositiveNumber } from '@/lib/validate'
import lndService from 'ln-service'

const { lnd } = lndService.authenticatedLndGrpc({
  cert: process.env.LND_CERT,
  macaroon: process.env.LND_MACAROON,
  socket: process.env.LND_SOCKET
})

// Check LND GRPC connection
lndService.getWalletInfo({ lnd }, (err, result) => {
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
    return 'INSUFFICIENT_BALANCE'
  } else if (withdrawal?.failed.is_invalid_payment) {
    return 'INVALID_PAYMENT'
  } else if (withdrawal?.failed.is_pathfinding_timeout) {
    return 'PATHFINDING_TIMEOUT'
  } else if (withdrawal?.failed.is_route_not_found) {
    return 'ROUTE_NOT_FOUND'
  }

  return 'UNKNOWN_FAILURE'
}

export default lnd
