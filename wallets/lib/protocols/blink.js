import { string } from 'yup'
import { fetchWithTimeout } from '@/lib/fetch'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'

// Blink
// http://blink.sv/

export const galoyBlinkUrl = 'https://api.blink.sv/graphql'
export const galoyBlinkDashboardUrl = 'https://dashboard.blink.sv/'

export const SCOPE_READ = 'READ'
export const SCOPE_WRITE = 'WRITE'
export const SCOPE_RECEIVE = 'RECEIVE'

const blinkApiKeyValidator = string().matches(/^blink_[A-Za-z0-9]+$/, 'must match pattern blink_A-Za-z0-9')
const blinkCurrencyValidator = string().oneOf(['BTC', 'USD'])

export default [
  {
    name: 'BLINK',
    displayName: 'API',
    send: true,
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        label: 'api key',
        placeholder: 'blink_...',
        help: [
          `Generate an API key in your [Blink Dashboard](${galoyBlinkDashboardUrl}) with the following scopes:`,
          '- READ',
          '- WRITE'
        ],
        validate: blinkApiKeyValidator,
        required: true,
        encrypt: true
      },
      {
        name: 'currency',
        label: 'currency',
        type: 'text',
        placeholder: 'BTC or USD',
        required: true,
        validate: blinkCurrencyValidator,
        encrypt: true
      }
    ],
    relationName: 'walletSendBlink'
  },
  {
    name: 'BLINK',
    displayName: 'API',
    send: false,
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        label: 'api key',
        placeholder: 'blink_...',
        help: [
          `Generate an API key in your [Blink Dashboard](${galoyBlinkDashboardUrl}) with the following scopes:`,
          '- READ',
          '- RECEIVE'
        ],
        validate: blinkApiKeyValidator,
        required: true
      },
      {
        name: 'currency',
        label: 'currency',
        type: 'text',
        placeholder: 'BTC or USD',
        required: true,
        validate: blinkCurrencyValidator
      }
    ],
    relationName: 'walletRecvBlink'
  }
]

export async function getWallet ({ apiKey, currency }, { signal }) {
  const out = await request({
    apiKey,
    query: `
      query me {
        me {
          defaultAccount {
            wallets {
              id
              walletCurrency
            }
          }
        }
      }`
  }, { signal })

  const wallets = out.data.me.defaultAccount.wallets
  for (const wallet of wallets) {
    if (wallet.walletCurrency === currency) {
      return wallet
    }
  }

  throw new Error(`wallet ${currency} not found`)
}

export async function request ({ apiKey, query, variables = {} }, { signal }) {
  const method = 'POST'
  const res = await fetchWithTimeout(galoyBlinkUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({ query, variables }),
    signal
  })

  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  return res.json()
}

export async function getScopes ({ apiKey }, { signal }) {
  const out = await request({
    apiKey,
    query: `
      query scopes {
        authorization {
          scopes
        }
      }`
  }, { signal })
  const scopes = out?.data?.authorization?.scopes
  return scopes || []
}
