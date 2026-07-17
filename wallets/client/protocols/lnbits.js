import { ResponseAssertError } from '@/lib/url'
import { msatsWalletBalance } from './util'
import { lnbitsRequest, lnbitsSettlementEvidence } from '@/wallets/lib/protocols/lnbits'

export const name = 'LNBITS'
// LNbits payments API has no per-payment routing fee cap field.
export const enforcesMaxFee = false

export async function sendPayment (bolt11, { url, apiKey }, { signal }) {
  await postPayment(bolt11, { url, apiKey }, { signal })
  return { status: 'PENDING' }
}

export async function checkPayment ({ hash }, { url, apiKey }, { signal }) {
  const payment = await getPayment(hash, { url, apiKey }, { signal })
  if (payment?.paid === true) {
    return {
      status: 'SETTLED',
      ...lnbitsSettlementEvidence(payment)
    }
  }
  if (payment?.status === 'failed') {
    return { status: 'FAILED', detail: 'lnbits reports payment failed' }
  }
  return { status: 'PENDING' }
}

export async function testSendPayment ({ url, apiKey }, { signal }) {
  try {
    await lnbitsRequest({
      url,
      apiKey,
      path: '/api/v1/payments',
      method: 'POST',
      body: JSON.stringify({ out: true }),
      signal
    })
  } catch (err) {
    if (err.status === 400 && !(err instanceof ResponseAssertError)) return
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
  return await lnbitsRequest({
    url,
    apiKey,
    path: `/api/v1/payments/${paymentHash}`,
    notFoundOk: true,
    signal
  })
}
