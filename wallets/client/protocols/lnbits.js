import { fetchWithTimeout } from '@/lib/fetch'
import { assertContentTypeJson } from '@/lib/url'

export const name = 'LNBITS'

export async function sendPayment (bolt11, { url, apiKey }, { signal }) {
  url = url.replace(/\/+$/, '')

  const response = await postPayment(bolt11, { url, apiKey }, { signal })

  const checkResponse = await getPayment(response.payment_hash, { url, apiKey }, { signal })
  if (!checkResponse.preimage) {
    throw new Error('No preimage')
  }

  return checkResponse.preimage
}

export async function testSendPayment ({ url, apiKey }, { signal }) {
  url = url.replace(/\/+$/, '')
  const w = await getWallet({ url, apiKey }, { signal })
  console.log(w)
}

async function getWallet ({ url, apiKey }, { signal }) {
  const path = '/api/v1/wallet'

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', apiKey)

  const method = 'GET'
  const res = await fetchWithTimeout(url + path, { method, headers, signal })

  assertContentTypeJson(res, { method })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const wallet = await res.json()
  return wallet
}

async function postPayment (bolt11, { url, apiKey }, { signal }) {
  const path = '/api/v1/payments'

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', apiKey)

  const body = JSON.stringify({ bolt11, out: true })

  const method = 'POST'
  const res = await fetchWithTimeout(url + path, { method, headers, body, signal })

  assertContentTypeJson(res, { method })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const payment = await res.json()
  return payment
}

async function getPayment (paymentHash, { url, apiKey }, { signal }) {
  const path = `/api/v1/payments/${paymentHash}`

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', apiKey)

  const method = 'GET'
  const res = await fetchWithTimeout(url + path, { method, headers, signal })

  assertContentTypeJson(res, { method })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const payment = await res.json()
  return payment
}
