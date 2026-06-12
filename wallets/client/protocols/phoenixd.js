import { snFetch } from '@/lib/fetch'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'
import { WalletPaymentRejectedError } from '@/wallets/client/errors'
import { walletBalance } from './util'

export const name = 'PHOENIXD'
// phoenixd /payinvoice does not accept a routing fee cap; users rely on
// phoenix.acinq's own fee policy.
export const enforcesMaxFee = false

export async function sendPayment (bolt11, { url, apiKey }, { signal }) {
  // https://phoenix.acinq.co/server/api#pay-bolt11-invoice
  const headers = new Headers()
  headers.set('Authorization', 'Basic ' + Buffer.from(':' + apiKey).toString('base64'))
  headers.set('Content-type', 'application/x-www-form-urlencoded')

  const body = new URLSearchParams()
  body.append('invoice', bolt11)

  const method = 'POST'
  const res = await snFetch(url, {
    path: '/payinvoice',
    method,
    headers,
    body,
    signal
  })

  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  const payment = await res.json()
  const preimage = payment.paymentPreimage
  if (!preimage) {
    // phoenixd reports why a payment failed; without a reason or preimage the
    // outcome is unprovable, so let sendWalletPayment's proof check flag it.
    if (payment.reason) throw new WalletPaymentRejectedError(payment.reason)
    return undefined
  }

  return preimage
}

export async function getBalance ({ url, apiKey }, { signal } = {}) {
  const headers = new Headers()
  headers.set('Accept', 'application/json')
  headers.set('Authorization', 'Basic ' + Buffer.from(':' + apiKey).toString('base64'))

  const method = 'GET'
  const res = await snFetch(url, {
    path: '/getbalance',
    method,
    headers,
    signal
  })

  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  const balance = await res.json()
  return walletBalance(balance.balanceSat)
}

export async function testSendPayment (config, { signal }) {
  // TODO:
  //   Not sure which endpoint to call to test primary password
  //   see https://phoenix.acinq.co/server/api
  //   Maybe just wait until test payments with HODL invoices?
  //   https://github.com/stackernews/stacker.news/issues/1287
}
