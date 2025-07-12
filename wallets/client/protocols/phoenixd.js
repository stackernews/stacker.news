import { fetchWithTimeout } from '@/lib/fetch'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'

export const name = 'PHOENIXD'

export async function sendPayment (bolt11, { url, apiKey }, { signal }) {
  // https://phoenix.acinq.co/server/api#pay-bolt11-invoice
  const path = '/payinvoice'

  const headers = new Headers()
  headers.set('Authorization', 'Basic ' + Buffer.from(':' + apiKey).toString('base64'))
  headers.set('Content-type', 'application/x-www-form-urlencoded')

  const body = new URLSearchParams()
  body.append('invoice', bolt11)

  const method = 'POST'
  const res = await fetchWithTimeout(url + path, {
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
    throw new Error(payment.reason)
  }

  return preimage
}

export async function testSendPayment (config, { signal }) {
  // TODO:
  //   Not sure which endpoint to call to test primary password
  //   see https://phoenix.acinq.co/server/api
  //   Maybe just wait until test payments with HODL invoices?
  //   https://github.com/stackernews/stacker.news/issues/1287
}
