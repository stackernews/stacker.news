import { fetchWithTimeout } from '@/lib/fetch'
import { assertContentTypeJson } from '@/lib/url'

export * from '@/wallets/lnbits'

export async function testSendPayment ({ url, adminKey, invoiceKey }, { signal }) {
  url = url.replace(/\/+$/, '')
  await getWallet({ url, adminKey, invoiceKey }, { signal })
}

export async function sendPayment (bolt11, { url, adminKey }, { signal }) {
  url = url.replace(/\/+$/, '')

  const response = await postPayment(bolt11, { url, adminKey }, { signal })

  const checkResponse = await getPayment(response.payment_hash, { url, adminKey }, { signal })
  if (!checkResponse.preimage) {
    throw new Error('No preimage')
  }

  return checkResponse.preimage
}

async function getWallet ({ url, adminKey, invoiceKey }, { signal }) {
  const path = '/api/v1/wallet'

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', adminKey || invoiceKey)

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

async function postPayment (bolt11, { url, adminKey }, { signal }) {
  const path = '/api/v1/payments'

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', adminKey)

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

async function getPayment (paymentHash, { url, adminKey }, { signal }) {
  const path = `/api/v1/payments/${paymentHash}`

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', adminKey)

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
