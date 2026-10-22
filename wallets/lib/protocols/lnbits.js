import { hexValidator, urlValidator } from '@/wallets/lib/validate'
import { snFetch } from '@/lib/fetch'
import { assertContentTypeJson } from '@/lib/url'
import { assertWalletAuthorized, WalletPermissionsError } from '@/wallets/lib/errors'

// LNbits
// https://github.com/lnbits/lnbits

export default [
  {
    name: 'LNBITS',
    displayName: 'LNbits',
    send: true,
    fields: [
      {
        name: 'url',
        label: 'url',
        type: 'text',
        // send wallet: dialed by the user's browser, so private/LAN addresses are allowed
        validate: urlValidator('clearnet', { allowPrivate: true }),
        required: true,
        share: true
      },
      {
        name: 'apiKey',
        label: 'admin key',
        type: 'password',
        validate: hexValidator(32),
        required: true,
        encrypt: true
      }
    ],
    relationName: 'walletSendLNbits'
  },
  {
    name: 'LNBITS',
    displayName: 'LNbits',
    send: false,
    fields: [
      {
        name: 'url',
        label: 'url',
        type: 'text',
        validate: urlValidator('clearnet', 'tor'),
        required: true,
        share: true
      },
      {
        name: 'apiKey',
        type: 'password',
        label: 'invoice key',
        validate: hexValidator(32),
        required: true
      }
    ],
    relationName: 'walletRecvLNbits'
  }
]

export async function lnbitsRequest ({
  url,
  protocol,
  apiKey,
  path,
  method = 'GET',
  body,
  signal,
  timeout,
  notFoundOk = false
}) {
  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', apiKey)

  const res = await snFetch(url, {
    path,
    protocol,
    method,
    headers,
    body,
    signal,
    timeout
  })

  if (res.status === 404) {
    const errBody = await res.json().catch(() => null)
    if (errBody?.detail === 'Wallet not found.') {
      throw Object.assign(new WalletPermissionsError(errBody.detail), { status: res.status })
    }
    if (notFoundOk) return null
    throw Object.assign(new Error(errBody?.detail || `${res.status} ${res.statusText}`), { status: res.status })
  }

  assertWalletAuthorized(res)
  assertContentTypeJson(res, { method })
  if (!res.ok) {
    const errBody = await res.json()
    throw Object.assign(new Error(errBody?.detail || `${res.status} ${res.statusText}`), { status: res.status })
  }

  return await res.json()
}

export function lnbitsSettlementEvidence (payment) {
  const details = payment?.details
  const settledAt = details?.updated_at ?? details?.time
  return {
    preimage: payment?.preimage,
    actualFeeMsats: typeof details?.fee === 'number' ? Math.abs(details.fee) : details?.fee,
    settledAt: typeof settledAt === 'number' ? { seconds: settledAt } : settledAt
  }
}
