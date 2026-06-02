import { snFetch } from '@/lib/fetch'
import { assertContentTypeJson } from '@/lib/url'
import { msatsWalletBalance, pollUntilSettled } from './util'
import { WalletPermissionsError } from '@/wallets/client/errors'

export const name = 'LNBITS'
// LNbits payments API has no per-payment routing fee cap field.
export const enforcesMaxFee = false
const accessDeniedStatuses = new Set([401, 403, 404])

export async function sendPayment (bolt11, { url, apiKey }, { signal }) {
  const { payment_hash: hash } = await postPayment(bolt11, { url, apiKey }, { signal })

  // LNbits v1 settles outgoing payments asynchronously (PENDING → SUCCESS/FAILED,
  // see https://docs.lnbits.com/guide/concepts#payment-states), so poll until it
  // reports a terminal state. A missing preimage on SUCCESS is handled by
  // sendWalletPayment (surfaced as settled-unknown for direct sends).
  return await pollUntilSettled(
    () => getPayment(hash, { url, apiKey }, { signal }),
    // LNbits v1 reports terminal failure as { paid: false, status: 'failed' }
    check => check?.paid === true
      ? { value: check.preimage }
      : check?.status === 'failed'
        ? { error: 'lnbits reports payment failed' }
        : null,
    { intervalMs: 500, signal }
  )
}

export async function testSendPayment ({ url, apiKey }, { signal }) {
  await getWallet({ url, apiKey }, { signal })
}

export async function getBalance ({ url, apiKey }, { signal } = {}) {
  const wallet = await getWallet({ url, apiKey }, { signal })
  // LNbits reports wallet.balance in millisats.
  return msatsWalletBalance(wallet.balance)
}

async function lnbitsRequest ({ url, apiKey, path, method = 'GET', body }, { signal }) {
  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', apiKey)

  const res = await snFetch(url, { path, method, headers, body, signal })

  assertContentTypeJson(res, { method })
  if (!res.ok) {
    const errBody = await res.json()
    const message = errBody.detail || `${res.status} ${res.statusText}`
    if (accessDeniedStatuses.has(res.status)) {
      throw new WalletPermissionsError(message)
    }
    throw Object.assign(new Error(message), {
      status: res.status,
      statusText: res.statusText
    })
  }

  return await res.json()
}

async function getWallet ({ url, apiKey }, { signal }) {
  return await lnbitsRequest({ url, apiKey, path: '/api/v1/wallet' }, { signal })
}

async function postPayment (bolt11, { url, apiKey }, { signal }) {
  const body = JSON.stringify({ bolt11, out: true })
  return await lnbitsRequest({ url, apiKey, path: '/api/v1/payments', method: 'POST', body }, { signal })
}

async function getPayment (paymentHash, { url, apiKey }, { signal }) {
  return await lnbitsRequest({ url, apiKey, path: `/api/v1/payments/${paymentHash}` }, { signal })
}
