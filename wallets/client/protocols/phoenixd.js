import { WalletPaymentRejectedError } from '@/wallets/client/errors'
import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'
import { phoenixdRequest } from '@/wallets/lib/protocols/phoenixd'
import { walletBalance } from './util'

export const name = 'PHOENIXD'
// phoenixd /payinvoice does not accept a routing fee cap; users rely on
// phoenix.acinq's own fee policy.
export const enforcesMaxFee = false

export async function sendPayment (bolt11, { url, apiKey }, { signal }) {
  const body = new URLSearchParams()
  body.append('invoice', bolt11)

  const payment = await phoenixdRequest({
    url,
    apiKey,
    path: '/payinvoice',
    method: 'POST',
    body,
    signal
  })
  const preimage = payment?.paymentPreimage
  if (!preimage) {
    if (payment?.reason) throw new WalletPaymentRejectedError(payment.reason)
    // phoenixd success includes paymentPreimage. A 2xx JSON response without
    // either success or failure fields is only a transport acknowledgement;
    // checkPayment owns the eventual provider status.
    return { status: 'PENDING' }
  }

  return {
    status: 'SETTLED',
    preimage,
    actualFeeMsats: walletAmountToMsatsOrUndefined({ sat: payment.routingFeeSat }),
    settledAt: { milliseconds: payment.completedAt }
  }
}

export async function checkPayment ({ hash }, { url, apiKey }, { signal }) {
  const payment = await phoenixdRequest({
    url,
    apiKey,
    path: `/payments/outgoingbyhash/${hash}`,
    signal,
    notFoundOk: true
  })
  if (!payment) return { status: 'PENDING' }
  if (payment.isPaid) {
    return {
      status: 'SETTLED',
      preimage: payment.preimage,
      actualFeeMsats: payment.fees,
      settledAt: { milliseconds: payment.completedAt }
    }
  }
  if (payment.isPaid === false && payment.completedAt != null) {
    return { status: 'FAILED', detail: 'phoenixd reports payment failed' }
  }
  return { status: 'PENDING' }
}

export async function getBalance ({ url, apiKey }, { signal } = {}) {
  const balance = await phoenixdRequest({
    url,
    apiKey,
    path: '/getbalance',
    signal
  })
  return walletBalance(balance.balanceSat)
}

export async function testSendPayment (config, { signal }) {
  // TODO:
  //   Not sure which endpoint to call to test primary password
  //   see https://phoenix.acinq.co/server/api
  //   Maybe just wait until test payments with HODL invoices?
  //   https://github.com/stackernews/stacker.news/issues/1287
}
