import { lnbitsPaymentCheckResult, lnbitsRequest } from '@/wallets/lib/lnbits'
import { msatsWalletBalance, pollPaymentCheckUntilSettled } from './util'

export const name = 'LNBITS'
// LNbits payments API has no per-payment routing fee cap field.
export const enforcesMaxFee = false

export async function sendPayment (bolt11, { url, apiKey }, { signal }) {
  const { payment_hash: hash } = await postPayment(bolt11, { url, apiKey }, { signal })

  // LNbits v1 settles outgoing payments asynchronously, so poll until it reports
  // a terminal state. A missing preimage on SUCCESS is recorded as UNKNOWN by
  // the external transaction classifier for direct sends.
  // Some deployments prune a failed outgoing payment's record, so the status read
  // 404s forever and the send stays UNKNOWN at the caller's timeout.
  return await pollPaymentCheckUntilSettled(
    () => checkPayment({ hash }, { url, apiKey }, { signal }),
    { intervalMs: 500, signal }
  )
}

export async function checkPayment ({ hash }, { url, apiKey }, { signal }) {
  return lnbitsPaymentCheckResult(await getPayment(hash, { url, apiKey }, { signal }))
}

export async function testSendPayment ({ url, apiKey }, { signal }) {
  // Probe pay capability: read-only keys can still GET /api/v1/wallet.
  try {
    await lnbitsRequest({ url, apiKey, path: '/api/v1/payments', method: 'POST', body: JSON.stringify({ out: true }), signal })
  } catch (err) {
    if (err.status === 400) return
    throw err
  }
}

export async function getBalance ({ url, apiKey }, { signal } = {}) {
  const wallet = await getWallet({ url, apiKey }, { signal })
  // LNbits reports wallet.balance in millisats.
  return msatsWalletBalance(wallet.balance)
}

async function getWallet ({ url, apiKey }, { signal }) {
  return await lnbitsRequest({ url, apiKey, path: '/api/v1/wallet', signal })
}

async function postPayment (bolt11, { url, apiKey }, { signal }) {
  const body = JSON.stringify({ bolt11, out: true })
  return await lnbitsRequest({ url, apiKey, path: '/api/v1/payments', method: 'POST', body, signal })
}

async function getPayment (paymentHash, { url, apiKey }, { signal }) {
  return await lnbitsRequest({ url, apiKey, path: `/api/v1/payments/${paymentHash}`, notFoundOk: true, signal })
}
