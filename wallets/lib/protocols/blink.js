import { string } from 'yup'
import { snFetch } from '@/lib/fetch'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'
import { assertWalletAuthorized, WalletPermissionsError } from '@/wallets/client/errors'

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

export function normalizeBlinkCurrency (currency) {
  return currency ? currency.toUpperCase() : 'BTC'
}

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

  // Blink can answer 200 with data.me = null plus a top-level error (e.g. internal wallet
  // lookup failures whose messages don't match the auth heuristic) — same shape guarded
  // in getTransactionByPaymentHash
  const wallets = out?.data?.me?.defaultAccount?.wallets
  if (!Array.isArray(wallets)) {
    throw new Error(out?.errors?.map(e => e.message).filter(Boolean).join(', ') || 'blink wallet lookup failed')
  }
  for (const wallet of wallets) {
    if (wallet.walletCurrency === currency) {
      return wallet
    }
  }

  throw new Error(`wallet ${currency} not found`)
}

// Blink TxStatus (and the overlapping PaymentSendResult mutation statuses)
export const BLINK_TX_SUCCESS = 'SUCCESS'
export const BLINK_TX_PENDING = 'PENDING'
export const BLINK_TX_FAILURE = 'FAILURE'
export const BLINK_TX_ALREADY_PAID = 'ALREADY_PAID'

export function blinkTransactionCheckResult (tx, { failureError = 'blink transaction failed' } = {}) {
  if (tx?.status === BLINK_TX_SUCCESS) {
    return {
      status: 'SETTLED',
      preimage: tx.preImage,
      // settlementFee/settlementAmount are denominated in the wallet currency's minor
      // unit, so only sat-denominated (BTC) values map to msats
      msats: blinkSatsToMsatsOrUndefined(tx, tx.settlementAmount),
      actualFeeMsats: blinkSatsToMsatsOrUndefined(tx, tx.settlementFee),
      settledAt: blinkDateOrUndefined(tx.createdAt)
    }
  }
  if (tx?.status === BLINK_TX_FAILURE) return { status: 'FAILED', error: tx.error || failureError }
  return { status: 'PENDING' }
}

function blinkSatsToMsatsOrUndefined (tx, sats) {
  if (tx?.settlementCurrency !== 'BTC') return undefined
  const n = Number(sats)
  if (!Number.isFinite(n)) return undefined
  return BigInt(Math.abs(Math.trunc(n))) * 1000n
}

function blinkDateOrUndefined (value) {
  if (value == null) return undefined
  // Blink's Timestamp scalar is unix seconds; tolerate ISO strings too
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const TX_BY_PAYMENT_HASH_FIELDS = `
  transactionsByPaymentHash(paymentHash: $paymentHash) {
    status
    direction
    settlementAmount
    settlementFee
    settlementCurrency
    createdAt
    settlementVia {
      ... on SettlementViaIntraLedger {
        preImage
      }
      ... on SettlementViaLn {
        preImage
      }
    }
  }`

// Without a wallet, the Wallet interface exposes the lookup on every wallet, so one
// request searches them all and skips the id-resolving round trip.
export async function getTransactionByPaymentHash (paymentHash, { apiKey, wallet, direction }, { signal }) {
  const out = await request({
    apiKey,
    query: wallet
      ? `query GetTxInfo($walletId: WalletId!, $paymentHash: PaymentHash!) {
          me { defaultAccount { walletById(walletId: $walletId) { ${TX_BY_PAYMENT_HASH_FIELDS} } } }
        }`
      : `query GetTxInfo($paymentHash: PaymentHash!) {
          me { defaultAccount { wallets { ${TX_BY_PAYMENT_HASH_FIELDS} } } }
        }`,
    variables: wallet ? { paymentHash, walletId: wallet.id } : { paymentHash }
  }, { signal })

  // A payment hash can have multiple transactions in the requested direction (e.g. a
  // failed attempt followed by an in-flight retry). Prefer terminal success, then
  // pending, then terminal failure so an older failed attempt never masks live work.
  // A null data/walletById/list must not throw a raw TypeError here. Distinguish two cases: a degraded
  // response (a non-auth top-level error — request() only throws for AUTH errors) is surfaced as a
  // transient failure carrying the provider's message; a genuinely absent list is "no matching tx yet".
  const account = out?.data?.me?.defaultAccount
  const list = wallet
    ? account?.walletById?.transactionsByPaymentHash
    : (Array.isArray(account?.wallets) ? account.wallets.flatMap(w => w?.transactionsByPaymentHash ?? []) : null)
  if (!Array.isArray(list)) {
    if (out?.errors?.length) throw new Error(out.errors.map(e => e.message).filter(Boolean).join(', ') || 'blink transaction lookup failed')
    return null
  }
  const txs = list.filter(t => t.direction === direction)
  const tx = [...txs].sort((a, b) => transactionRank(b) - transactionRank(a))[0] ?? null
  if (!tx) return null

  return {
    status: tx.status,
    preImage: tx.settlementVia?.preImage,
    settlementAmount: tx.settlementAmount,
    settlementFee: tx.settlementFee,
    settlementCurrency: tx.settlementCurrency,
    createdAt: tx.createdAt,
    error: ''
  }
}

// Expired unpaid invoices never create transactions; this is their terminal signal.
export async function getInvoiceStatusByPaymentHash (paymentHash, { apiKey, wallet }, { signal }) {
  const out = await request({
    apiKey,
    query: `
      query GetInvoiceStatus($walletId: WalletId!, $paymentHash: PaymentHash!) {
        me {
          defaultAccount {
            walletById(walletId: $walletId) {
              invoiceByPaymentHash(paymentHash: $paymentHash) {
                paymentStatus
              }
            }
          }
        }
      }`,
    variables: {
      paymentHash,
      walletId: wallet.id
    }
  }, { signal })

  return out?.data?.me?.defaultAccount?.walletById?.invoiceByPaymentHash?.paymentStatus ?? null
}

function transactionRank (tx) {
  if (tx?.status === BLINK_TX_SUCCESS) return 3
  if (tx?.status === BLINK_TX_PENDING) return 2
  if (tx?.status === BLINK_TX_FAILURE) return 1
  return 0
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

  assertWalletAuthorized(res)
  // Apollo Router can return useful GraphQL errors inside HTTP 400.
  if (!res.ok && res.headers.get('content-type')?.includes('application/json')) {
    const errBody = await res.json().catch(() => null)
    if (errBody?.errors?.length) {
      throw new Error(errBody.errors.map(e => e.message).filter(Boolean).join(', ') || 'blink request failed')
    }
  }
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
