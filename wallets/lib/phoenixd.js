import { snFetch } from '@/lib/fetch'
import { assertContentTypeJson, assertResponseOk, assertWalletAuthorized } from '@/lib/url'

export async function phoenixdRequest ({
  url,
  apiKey,
  path,
  method = 'GET',
  body,
  signal,
  timeout,
  notFoundOk = false
}) {
  const headers = new Headers()
  headers.set('Accept', 'application/json')
  headers.set('Authorization', 'Basic ' + Buffer.from(':' + apiKey).toString('base64'))
  if (body) headers.set('Content-Type', 'application/x-www-form-urlencoded')

  const res = await snFetch(url, {
    path,
    method,
    headers,
    body,
    signal,
    timeout
  })

  if (notFoundOk && res.status === 404) return null

  assertWalletAuthorized(res)
  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  return await res.json()
}

export function phoenixdFormBody (entries) {
  const body = new URLSearchParams()
  Object.entries(entries).forEach(([key, value]) => {
    if (value !== undefined && value !== null) body.append(key, value)
  })
  return body
}

export async function getIncomingPayment ({ paymentHash }, { url, apiKey }, { signal }) {
  return await phoenixdRequest({
    url,
    apiKey,
    path: `/payments/incoming/${paymentHash}`,
    method: 'GET',
    signal,
    notFoundOk: true
  })
}

export function phoenixdCompletedAt (payment) {
  return payment?.completedAt ? new Date(Number(payment.completedAt)) : undefined
}
