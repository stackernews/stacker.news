import { msatsToSats } from '@/lib/format'
import { getAgent } from '@/lib/proxy'

export * from 'wallets/lnbits'

export async function testCreateInvoice ({ url, invoiceKey }) {
  return await createInvoice({ msats: 1000, expiry: 1 }, { url, invoiceKey })
}

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { url, invoiceKey }) {
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

  const res = await fetch(`${agent.protocol}//${hostname}${path}`, {
    method: 'POST',
    headers,
    agent,
    body
  })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const payment = await res.json()
  return payment.payment_request
}
