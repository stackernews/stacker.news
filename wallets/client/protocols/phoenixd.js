import { WalletPaymentRejectedError } from '@/wallets/client/errors'
import {
  getOutgoingPayment,
  phoenixdCompletedAt,
  phoenixdFormBody,
  phoenixdRequest
} from '@/wallets/lib/phoenixd'
import { satsToMsats } from '@/lib/format'
import { walletAmountToMsatsOrUndefined, walletAmountToSatsOrUndefined } from '@/wallets/lib/amount'
import { walletBalance } from './util'

export const name = 'PHOENIXD'
// phoenixd /payinvoice does not accept a routing fee cap; users rely on
// phoenix.acinq's own fee policy.
export const enforcesMaxFee = false

export async function sendPayment (bolt11, { url, apiKey }, { signal }) {
  // https://phoenix.acinq.co/server/api#pay-bolt11-invoice
  const payment = await phoenixdRequest({
    url,
    apiKey,
    path: '/payinvoice',
    method: 'POST',
    body: phoenixdFormBody({ invoice: bolt11 }),
    signal
  })

  const preimage = payment.paymentPreimage
  if (!preimage) {
    if (payment.reason) throw new WalletPaymentRejectedError(payment.reason)
    // phoenixd reports why a payment failed; without a reason or preimage the
    // outcome is unprovable, so let the external transaction classifier record it.
    return undefined
  }

  const routingFeeSats = walletAmountToSatsOrUndefined(payment.routingFeeSat)
  return {
    preimage,
    actualFeeMsats: routingFeeSats == null ? undefined : satsToMsats(routingFeeSats)
  }
}

export async function checkPayment ({ hash }, { url, apiKey }, { signal }) {
  const payment = await getOutgoingPayment({ paymentHash: hash }, { url, apiKey }, { signal })
  if (!payment) return { status: 'PENDING' }

  if (payment.isPaid) {
    return {
      status: 'SETTLED',
      preimage: payment.preimage,
      actualFeeMsats: walletAmountToMsatsOrUndefined(payment.fees),
      settledAt: phoenixdCompletedAt(payment)
    }
  }

  if (payment.isPaid === false && payment.completedAt != null) {
    return {
      status: 'FAILED',
      error: 'phoenixd reports payment failed'
    }
  }

  return { status: 'PENDING' }
}

export async function getBalance ({ url, apiKey }, { signal } = {}) {
  const balance = await phoenixdRequest({
    url,
    apiKey,
    path: '/getbalance',
    method: 'GET',
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
