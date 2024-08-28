export * from 'wallets/lnbits'

export async function sendPayment (bolt11, { url, adminKey }) {
  url = url.replace(/\/+$/, '')

  const response = await postPayment(bolt11, { url, adminKey })

  const checkResponse = await getPayment(response.payment_hash, { url, adminKey })
  if (!checkResponse.preimage) {
    throw new Error('No preimage')
  }

  return checkResponse.preimage
}

async function postPayment (bolt11, { url, adminKey }) {
  const path = '/api/v1/payments'

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', adminKey)

  const body = JSON.stringify({ bolt11, out: true })

  const res = await fetch(url + path, { method: 'POST', headers, body })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const payment = await res.json()
  return payment
}

async function getPayment (paymentHash, { url, adminKey }) {
  const path = `/api/v1/payments/${paymentHash}`

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', adminKey)

  const res = await fetch(url + path, { method: 'GET', headers })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const payment = await res.json()
  return payment
}
