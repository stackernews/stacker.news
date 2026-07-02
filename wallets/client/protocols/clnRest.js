import { clnPaymentFeeMsats, getBalance as clnGetBalance, getPayment as clnGetPayment, runeMayAllowMethod, sendPayment as clnSendPayment } from '@/lib/cln'
import { verificationUnsupportedResult } from '@/wallets/lib/external-transactions'
import { msatsWalletBalance } from './util'

export const name = 'CLN_REST'
// CLN enforces a hard routing fee cap via `pay.maxfee`, so we can pass the
// user-supplied max fee through to the wallet and trust it.
export const enforcesMaxFee = true

export const sendPayment = async (bolt11, config, { signal, maxFee }) => {
  return await clnSendPayment(bolt11, config, { signal, maxFee })
}

export const checkPayment = async ({ hash }, config, { signal }) => {
  // a send-only rune deliberately omits listpays (the field help endorses this), so settlement
  // can never be verified for it — classify as unsupported (stop polling, benign message) rather than
  // PERMISSION_REQUIRED, which would re-poll for 24h with a misleading "update wallet permissions" notice
  if (!runeMayAllowMethod(config.rune, 'listpays')) {
    return verificationUnsupportedResult('cln rune does not allow listpays')
  }

  const payment = await clnGetPayment({ paymentHash: hash }, config, { signal })
  // Missing records may be pruned or never written; the shared deadline bounds PENDING.
  if (!payment) return { status: 'PENDING' }

  if (payment.status === 'complete') {
    return {
      status: 'SETTLED',
      preimage: payment.preimage,
      actualFeeMsats: clnPaymentFeeMsats(payment)
    }
  }
  if (payment.status === 'failed') {
    return {
      status: 'FAILED',
      error: 'cln reports payment failed'
    }
  }

  return { status: 'PENDING' }
}

export const getBalance = async (config, { signal } = {}) => {
  if (!runeMayAllowMethod(config.rune, 'bkpr-listbalances')) return null

  // CLN bkpr-listbalances reports channel balances in millisats.
  return msatsWalletBalance(await clnGetBalance(config, { signal }))
}

export const testSendPayment = async ({ socket, rune, cert }, { signal }) => {
  // We only can use the /pay endpoint with the rune so we can't
  // really test the configuration without paying something
  // until https://github.com/stackernews/stacker.news/issues/1287
}
