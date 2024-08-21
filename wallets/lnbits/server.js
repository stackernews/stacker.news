import { msatsToSats } from '@/lib/format'

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

  const res = await fetch(url + path, { method: 'POST', headers, body })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const payment = await res.json()
  return payment.payment_request
}
