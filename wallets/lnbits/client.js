export * from 'wallets/lnbits'

export async function testConnectClient ({ url, adminKey }, { logger }) {
  logger.info('trying to fetch wallet')

  url = url.replace(/\/+$/, '')
  await getWallet({ url, adminKey })

  logger.ok('wallet found')
}

export async function sendPayment (bolt11, { url, adminKey }) {
  url = url.replace(/\/+$/, '')

  const response = await postPayment(bolt11, { url, adminKey })

  const checkResponse = await getPayment(response.payment_hash, { url, adminKey })
  if (!checkResponse.preimage) {
    throw new Error('No preimage')
  }

  const preimage = checkResponse.preimage
  return { preimage }
}

async function getWallet ({ url, adminKey }) {
  const path = '/api/v1/wallet'

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', adminKey)

  const res = await fetch(url + path, { method: 'GET', headers })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const wallet = await res.json()
  return wallet
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
