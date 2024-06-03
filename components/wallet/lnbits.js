import { bolt11Tags } from '@/lib/bolt11'

export const name = 'lnbits'

export const fields = [
  {
    name: 'url',
    label: 'lnbits url',
    type: 'text'
  },
  {
    name: 'adminKey',
    label: 'admin key',
    type: 'password'
  }
]

export const card = {
  title: 'LNbits',
  badges: ['send only', 'non-custodialish']
}

export async function validate ({ logger, ...config }) {
  return await getInfo({ logger, ...config })
}

async function getInfo ({ logger, ...config }) {
  const response = await getWallet(config.url, config.adminKey)
  return {
    node: {
      alias: response.name,
      pubkey: ''
    },
    methods: [
      'getInfo',
      'getBalance',
      'sendPayment'
    ],
    version: '1.0',
    supports: ['lightning']
  }
}

export async function sendPayment ({ bolt11, config, logger }) {
  const { url, adminKey } = config

  const hash = bolt11Tags(bolt11).payment_hash
  logger.info('sending payment:', `payment_hash=${hash}`)

  try {
    const response = await postPayment(url, adminKey, bolt11)

    const checkResponse = await getPayment(url, adminKey, response.payment_hash)
    if (!checkResponse.preimage) {
      throw new Error('No preimage')
    }

    const preimage = checkResponse.preimage
    logger.ok('payment successful:', `payment_hash=${hash}`, `preimage=${preimage}`)
    return { preimage }
  } catch (err) {
    logger.error('payment failed:', `payment_hash=${hash}`, err.message || err.toString?.())
    throw err
  }
}

async function getWallet (baseUrl, adminKey) {
  const url = baseUrl.replace(/\/+$/, '')
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

async function postPayment (baseUrl, adminKey, bolt11) {
  const url = baseUrl.replace(/\/+$/, '')
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

async function getPayment (baseUrl, adminKey, paymentHash) {
  const url = baseUrl.replace(/\/+$/, '')
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
