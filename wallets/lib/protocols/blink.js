import { string } from 'yup'
import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'
import { snFetch } from '@/lib/fetch'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'
import { assertWalletAuthorized, WalletPermissionsError } from '@/wallets/lib/errors'

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
    throw new Error(blinkErrorsMessage(out?.errors, 'blink wallet lookup failed'))
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

export function blinkTransactionCheckResult (tx) {
  if (tx?.status === BLINK_TX_SUCCESS) {
    return {
      status: 'SETTLED',
      preimage: tx.preImage,
      // settlementFee/settlementAmount are denominated in the wallet currency's minor
      // unit, so only sat-denominated (BTC) values map to msats
      msats: blinkSatsToMsatsOrUndefined(tx, tx.settlementAmount),
      actualFeeMsats: blinkSatsToMsatsOrUndefined(tx, tx.settlementFee),
      settledAt: { seconds: tx.createdAt }
    }
  }
  if (tx?.status === BLINK_TX_FAILURE) return { status: 'FAILED' }
  return { status: 'PENDING' }
}

function blinkSatsToMsatsOrUndefined (tx, sats) {
  // settlementAmount/Fee are denominated in the wallet currency's minor unit
  if (tx?.settlementCurrency !== 'BTC') return undefined
  // declared-unit wrapper; the classifier validates it
  return walletAmountToMsatsOrUndefined({ sat: sats })
}

export function blinkErrorsMessage (errors, fallback) {
  return errors?.map(e => e.message).filter(Boolean).join(', ') || fallback
}

const TX_BY_PAYMENT_HASH_FIELDS = `
  id
  walletCurrency
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
export async function getTransactionByPaymentHash (paymentHash, { apiKey, wallet, currency, direction }, { signal }) {
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
  // Any top-level error (request() only throws for AUTH errors) means the answer is
  // degraded — even when a partial wallets list is present — so surface it as a transient
  // failure carrying the provider's message; an absent list without errors is "no matching tx yet".
  if (out?.errors?.length) throw new Error(blinkErrorsMessage(out.errors, 'blink transaction lookup failed'))
  const account = out?.data?.me?.defaultAccount
  const wallets = wallet
    ? (account?.walletById ? [account.walletById] : null)
    : account?.wallets
  if (!Array.isArray(wallets)) {
    return { transaction: null, wallet: null }
  }
  const list = wallets.flatMap(w => w?.transactionsByPaymentHash ?? [])
  const txs = list.filter(t => t.direction === direction)
  const tx = [...txs].sort((a, b) => transactionRank(b) - transactionRank(a))[0] ?? null
  let resolvedWallet = wallet
  if (currency) {
    resolvedWallet = wallets.find(w => w?.walletCurrency === currency)
  } else if (!resolvedWallet && tx) {
    resolvedWallet = wallets.find(w => w?.transactionsByPaymentHash?.includes(tx))
  }

  return {
    transaction: tx
      ? {
          status: tx.status,
          preImage: tx.settlementVia?.preImage,
          settlementAmount: tx.settlementAmount,
          settlementFee: tx.settlementFee,
          settlementCurrency: tx.settlementCurrency,
          createdAt: tx.createdAt
        }
      : null,
    wallet: resolvedWallet
      ? {
          id: resolvedWallet.id,
          walletCurrency: resolvedWallet.walletCurrency
        }
      : null
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

  // a degraded answer must retry as a transient failure, not read as "unpaid"
  if (out?.errors?.length) {
    throw new Error(blinkErrorsMessage(out.errors, 'blink invoice status lookup failed'))
  }
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
      throw new Error(blinkErrorsMessage(errBody.errors, 'blink request failed'))
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
