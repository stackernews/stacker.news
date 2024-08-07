export * from 'wallets/lnbits'

async function _createInvoice ({ url, invoiceKey, amount, expiry }, { me }) {
  const path = '/api/v1/payments'

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', invoiceKey)

  const memo = me.hideInvoiceDesc ? undefined : 'autowithdraw to LNbits from SN'
  const body = JSON.stringify({ amount, unit: 'sat', expiry, memo, out: false })

  const res = await fetch(url + path, { method: 'POST', headers, body })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const payment = await res.json()
  return payment.payment_request
}

export async function testConnectServer ({ url, invoiceKey }, { me }) {
  return await _createInvoice({ url, invoiceKey, amount: 1, expiry: 1 }, { me })
}

export async function createInvoice ({ amount, maxFee }, { url, invoiceKey }, { me }) {
  return await _createInvoice({ url, invoiceKey, amount, expiry: 360 }, { me })
}
