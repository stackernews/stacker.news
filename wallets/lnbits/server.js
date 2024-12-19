import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { FetchTimeoutError } from '@/lib/fetch'
import { msatsToSats } from '@/lib/format'
import { getAgent } from '@/lib/proxy'
import { assertContentTypeJson } from '@/lib/url'
import fetch from 'cross-fetch'

export * from '@/wallets/lnbits'

export async function testCreateInvoice ({ url, invoiceKey }, { signal }) {
  return await createInvoice({ msats: 1000, expiry: 1 }, { url, invoiceKey }, { signal })
}

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { url, invoiceKey },
  { signal }) {
  const path = '/api/v1/payments'

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', invoiceKey)

  // lnbits doesn't support msats so we have to floor to nearest sat
  const sats = msatsToSats(msats)

  const body = JSON.stringify({
    amount: sats,
    unit: 'sat',
    expiry,
    memo: description,
    out: false
  })

  let hostname = url.replace(/^https?:\/\//, '')
  const agent = getAgent({ hostname })

  if (process.env.NODE_ENV !== 'production' && hostname.startsWith('localhost:')) {
    // to make it possible to attach LNbits for receives during local dev
    hostname = 'lnbits:5000'
  }

  let res
  try {
    res = await fetch(`${agent.protocol}//${hostname}${path}`, {
      method: 'POST',
      headers,
      agent,
      body,
      signal
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      // XXX node-fetch doesn't throw our custom TimeoutError but throws a generic error so we have to handle that manually.
      // see https://github.com/node-fetch/node-fetch/issues/1462
      throw new FetchTimeoutError('POST', url, WALLET_CREATE_INVOICE_TIMEOUT_MS)
    }
    throw err
  }

  assertContentTypeJson(res)
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const payment = await res.json()
  return payment.payment_request
}
