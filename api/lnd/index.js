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

export async function estimateRouteFee ({ lnd, request, timeout }) {
  return await new Promise((resolve, reject) => {
    lnd.router.estimateRouteFee({ request: Buffer.from(request, 'hex'), timeout }, (err, res) => {
      if (err) {
        reject(err)
      } else {
        if (res.failure_reason) {
          reject(new Error(`Unable to estimate route: ${res.failure_reason}`))
        }

        if (!res.routing_fee_msat || res.routing_fee_msat <= 0 ||
          res.routing_fee_msat >= Number.MAX_SAFE_INTEGER || !res.time_lock_delay ||
          res.time_lock_delay <= 0 || res.time_lock_delay >= Number.MAX_SAFE_INTEGER) {
          reject(new Error('Unable to estimate route, excessive values: ' + JSON.stringify(res)))
        }

        resolve({
          routingFeeMsat: Number(res.routing_fee_msat),
          timeLockDelay: Number(res.time_lock_delay)
        })
      }
    })
  })
}

// created_height is the accepted_height, timeout is the expiry height
// ln-service has remaps the `htlcs` field of lookupInvoice to `payments` and
// see: https://github.com/alexbosworth/lightning/blob/master/lnd_responses/htlc_as_payment.js
// and: https://lightning.engineering/api-docs/api/lnd/lightning/lookup-invoice/index.html#lnrpcinvoicehtlc
export async function hodlInvoiceCltvDetails (inv) {
  if (!inv.payments) {
    throw new Error('No payments found')
  }
  if (!inv.is_held) {
    throw new Error('Invoice is not held')
  }

  const acceptedHeight = inv.payments.reduce((max, htlc) => {
    return htlc.created_height > max ? htlc.created_height : max
  }, 0)
  const expiryHeight = inv.payments.reduce((min, htlc) => {
    return htlc.timeout < min ? htlc.timeout : min
  }, Number.MAX_SAFE_INTEGER)

  if (expiryHeight < acceptedHeight) {
    throw new Error('Inconsistent payment HTLCs')
  }

  return {
    expiryHeight,
    acceptedHeight
  }
}

export default lnd
