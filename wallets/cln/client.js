import { fetchWithTimeout } from '@/lib/fetch'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'

export * from '@/wallets/cln'

export async function testSendPayment ({ socket, runePay }, { logger, signal }) {
  // TODO: check rune
}

export async function sendPayment (bolt11, { socket, runePay }, { logger, signal }) {
  const url = `https://${socket}/v1/pay`

  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  headers.set('Rune', runePay)
  // see nodeId in lib/cln.js
  headers.set('nodeId', '02cb2e2d5a6c5b17fa67b1a883e2973c82e328fb9bd08b2b156a9e23820c87a490')

  const body = new URLSearchParams()
  body.append('bolt11', bolt11)

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body,
    signal
  })

  assertResponseOk(res)
  assertContentTypeJson(res)

  const payment = await res.json()
  const preimage = payment.data.payment_preimage
  if (!preimage) {
    throw new Error(payment.reason)
  }

  return preimage
}
