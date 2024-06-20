import { TOR_REGEXP } from '@/lib/url'
import { object, string } from 'yup'

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

export const schema = object({
  url: process.env.NODE_ENV === 'development'
    ? string()
      .or([string().matches(/^(http:\/\/)?localhost:\d+$/), string().url()], 'invalid url')
      .required('required').trim()
    : string().url().required('required').trim()
      .test(async (url, context) => {
        if (TOR_REGEXP.test(url)) {
          // allow HTTP and HTTPS over Tor
          if (!/^https?:\/\//.test(url)) {
            return context.createError({ message: 'http or https required' })
          }
          return true
        }
        try {
          // force HTTPS over clearnet
          await string().https().validate(url)
        } catch (err) {
          return context.createError({ message: err.message })
        }
        return true
      }),
  adminKey: string().length(32)
})

async function getInfo ({ logger, ...config }) {
  logger.info('trying to fetch wallet')
  const response = await getWallet(config.url, config.adminKey)
  logger.ok('wallet found')
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

export async function sendPayment ({ bolt11, config }) {
  const { url, adminKey } = config

  const response = await postPayment(url, adminKey, bolt11)

  const checkResponse = await getPayment(url, adminKey, response.payment_hash)
  if (!checkResponse.preimage) {
    throw new Error('No preimage')
  }

  const preimage = checkResponse.preimage
  return { preimage }
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
