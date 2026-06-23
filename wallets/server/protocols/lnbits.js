import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { snFetch } from '@/lib/fetch'
import { msatsToSats, msatsSatsFloor } from '@/lib/format'
import { assertContentTypeJson, assertWalletAuthorized } from '@/lib/url'

export const name = 'LNBITS'
// lnbits only invoices whole sats, so it can receive a request snapped down to the sat grid
export const receivableMsats = msatsSatsFloor

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { url, apiKey },
  { signal }) {
  // lnbits doesn't support msats so we have to floor to nearest sat
  const sats = msatsToSats(msats)

  const body = JSON.stringify({
    amount: sats,
    unit: 'sat',
    expiry,
    memo: description,
    out: false
  })

  const { baseUrl, protocol } = lnbitsBaseUrl(url)
  const method = 'POST'
  const payment = await lnbitsRequest({
    baseUrl,
    protocol,
    apiKey,
    path: '/api/v1/payments',
    method,
    body,
    signal,
    timeout: WALLET_CREATE_INVOICE_TIMEOUT_MS
  })

  return payment?.payment_request || payment?.bolt11
}

export async function checkInvoice ({ hash }, { url, apiKey }, { signal }) {
  const { baseUrl, protocol } = lnbitsBaseUrl(url)
  const payment = await lnbitsRequest({
    baseUrl,
    protocol,
    apiKey,
    path: `/api/v1/payments/${hash}`,
    method: 'GET',
    signal,
    notFoundOk: true
  })
  if (!payment) return { status: 'PENDING' }

  if (payment?.paid === true) {
    return {
      status: 'SETTLED',
      preimage: payment.preimage
    }
  }
  if (payment?.status === 'failed') {
    return {
      status: 'FAILED',
      error: 'lnbits invoice failed'
    }
  }

  return { status: 'PENDING' }
}

async function lnbitsRequest ({ baseUrl, protocol, apiKey, path, method, body, signal, timeout, notFoundOk = false }) {
  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', apiKey)

  const res = await snFetch(baseUrl, {
    path,
    protocol,
    method,
    headers,
    body,
    signal,
    timeout
  })

  if (notFoundOk && res.status === 404) return null

  assertWalletAuthorized(res)
  assertContentTypeJson(res, { method })
  if (!res.ok) {
    const errBody = await res.json()
    throw Object.assign(new Error(errBody.detail), { status: res.status })
  }

  return await res.json()
}

function lnbitsBaseUrl (url) {
  let baseUrl = url
  let protocol
  if (process.env.NODE_ENV !== 'production') {
    // to make it possible to attach LNbits for receives during local dev
    const hostname = baseUrl.replace(/^https?:\/\//, '').split(/[:/]/)[0]
    if (hostname === 'localhost') {
      const port = baseUrl.match(/:(\d+)/)?.[1]
      baseUrl = port === process.env.LNBITS_WEB_PORT ? 'lnbits:5000' : 'lnbits-v1:5000'
      // Docker LNbits containers run HTTP on port 5000
      protocol = 'http'
    }
  }
  return { baseUrl, protocol }
}

export async function testCreateInvoice ({ url, apiKey }, { signal }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { url, apiKey },
    { signal }
  )
}
