import { string } from 'yup'
import { snFetch } from '@/lib/fetch'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'
import { WalletPermissionsError } from '@/wallets/client/errors'

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
    displayName: 'Blink',
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
    displayName: 'Blink',
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
              balance
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

// Looks up a transaction by one of Blink's lookup fields (paymentRequest or
// paymentHash) and returns the entry matching the requested direction.
async function getTransaction ({ field, varName, varType, value }, { apiKey, wallet, direction }, { signal }) {
  const out = await request({
    apiKey,
    query: `
      query GetTxInfo($walletId: WalletId!, $${varName}: ${varType}) {
        me {
          defaultAccount {
            walletById(walletId: $walletId) {
              ${field}(${varName}: $${varName}) {
                status
                direction
                settlementVia {
                  ... on SettlementViaIntraLedger {
                    preImage
                  }
                  ... on SettlementViaLn {
                    preImage
                  }
                }
              }
            }
          }
        }
      }`,
    variables: {
      [varName]: value,
      walletId: wallet.id
    }
  }, { signal })

  // A payment hash can have multiple transactions in the requested direction (e.g. a
  // failed attempt followed by a successful retry). Prefer a SUCCESS so a later
  // settlement is never masked by an earlier failed attempt.
  // A null data/walletById/list must not throw a raw TypeError here. Distinguish two cases: a degraded
  // response (a non-auth top-level error — request() only throws for AUTH errors) is surfaced as a
  // transient failure carrying the provider's message; a genuinely absent list is "no matching tx yet".
  const list = out?.data?.me?.defaultAccount?.walletById?.[field]
  if (!Array.isArray(list)) {
    if (out?.errors?.length) throw new Error(out.errors.map(e => e.message).filter(Boolean).join(', ') || 'blink transaction lookup failed')
    return null
  }
  const txs = list.filter(t => t.direction === direction)
  const tx = txs.find(t => t.status === 'SUCCESS') ?? txs[0]
  if (!tx) return null

  return {
    status: tx.status,
    preImage: tx.settlementVia?.preImage,
    error: ''
  }
}

export async function getTransactionByPaymentHash (paymentHash, { apiKey, wallet, direction }, { signal }) {
  return await getTransaction(
    { field: 'transactionsByPaymentHash', varName: 'paymentHash', varType: 'PaymentHash!', value: paymentHash },
    { apiKey, wallet, direction }, { signal })
}

export async function request ({ apiKey, query, variables = {} }, { signal }) {
  const method = 'POST'
  const res = await snFetch(galoyBlinkUrl, {
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

  const body = await res.json()
  const authError = body.errors?.find(isAuthGraphQLError)
  if (authError) {
    throw new WalletPermissionsError(authError.message || 'blink authorization failed')
  }

  return body
}

function isAuthGraphQLError (err) {
  const text = [
    err?.message,
    err?.code,
    err?.extensions?.code,
    err?.extensions?.error,
    err?.extensions?.classification
  ].filter(Boolean).join(' ').toLowerCase()

  return ['auth', 'unauthorized', 'unauthorised', 'forbidden', 'permission', 'scope']
    .some(term => text.includes(term))
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
