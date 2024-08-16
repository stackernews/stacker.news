export * from 'wallets/lnbits'

export async function testConnectServer ({ url, invoiceKey }) {
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

  const body = JSON.stringify({
    amount: msats,
    unit: 'msat',
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
