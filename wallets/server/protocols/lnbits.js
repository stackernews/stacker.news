import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { snFetch } from '@/lib/fetch'
import { msatsToSats } from '@/lib/format'
import { assertContentTypeJson } from '@/lib/url'

export const name = 'LNBITS'

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { url, apiKey },
  { signal }) {
  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', apiKey)

  // lnbits doesn't support msats so we have to floor to nearest sat
  const sats = msatsToSats(msats)

  const body = JSON.stringify({
    amount: sats,
    unit: 'sat',
    expiry,
    memo: description,
    out: false
  })

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

  const method = 'POST'
  const res = await snFetch(baseUrl, {
    path: '/api/v1/payments',
    protocol,
    method,
    headers,
    body,
    signal,
    timeout: WALLET_CREATE_INVOICE_TIMEOUT_MS
  })

  assertContentTypeJson(res, { method })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const payment = await res.json()
  return payment?.payment_request || payment?.bolt11
}

export async function testCreateInvoice ({ url, apiKey }, { signal }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { url, apiKey },
    { signal }
  )
}
