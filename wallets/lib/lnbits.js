import { snFetch } from '@/lib/fetch'
import { assertContentTypeJson } from '@/lib/url'
import { assertWalletAuthorized, WalletPermissionsError } from '@/wallets/client/errors'

export async function lnbitsRequest ({ url, protocol, apiKey, path, method = 'GET', body, signal, timeout, notFoundOk = false }) {
  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', apiKey)

  const res = await snFetch(url, { path, protocol, method, headers, body, signal, timeout })

  if (notFoundOk && res.status === 404) return null

  assertWalletAuthorized(res)
  assertContentTypeJson(res, { method })
  if (!res.ok) {
    const errBody = await res.json()
    const message = errBody.detail || `${res.status} ${res.statusText}`
    // LNbits uses 404 "Wallet not found." for invalid/revoked keys.
    if (res.status === 404 && errBody.detail === 'Wallet not found.') {
      throw Object.assign(new WalletPermissionsError(message), { status: res.status })
    }
    // the balance classifier reads err.status to distinguish permanent errors
    throw Object.assign(new Error(message), { status: res.status })
  }

  return await res.json()
}

export function lnbitsPaymentCheckResult (payment, { failedError = 'lnbits reports payment failed' } = {}) {
  if (payment?.paid === true) {
    // details shape varies by deployment; absent fields degrade to undefined.
    const details = payment.details
    return {
      status: 'SETTLED',
      preimage: payment.preimage,
      msats: lnbitsMsatsOrUndefined(details?.amount),
      actualFeeMsats: lnbitsMsatsOrUndefined(details?.fee),
      settledAt: lnbitsDateOrUndefined(details?.updated_at ?? details?.time)
    }
  }
  if (payment?.status === 'failed') {
    return {
      status: 'FAILED',
      error: failedError
    }
  }

  return { status: 'PENDING' }
}

function lnbitsMsatsOrUndefined (value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return undefined
  return BigInt(Math.abs(Math.trunc(n)))
}

function lnbitsDateOrUndefined (value) {
  if (value == null) return undefined
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}
