import { PAY_IN_AUTO_RETRY_TYPES, WALLET_MAX_RETRIES, WALLET_RETRY_BEFORE_MS } from '@/lib/constants'
import { WalletConfigurationError } from '@/wallets/client/errors'

export function isAutoRetryEligiblePayIn (payIn) {
  if (!payIn || !payIn.payerPrivates) return false

  const {
    payInState,
    payInType,
    payInStateChangedAt,
    payerPrivates: { payInFailureReason, retryCount }
  } = payIn

  return payInState !== 'PAID' &&
    PAY_IN_AUTO_RETRY_TYPES.includes(payInType) &&
    retryCount < WALLET_MAX_RETRIES &&
    new Date(payInStateChangedAt) > new Date(Date.now() - WALLET_RETRY_BEFORE_MS) &&
    payInFailureReason !== 'USER_CANCELLED'
}

export async function retryFailedPayIn (payIn, {
  sendProtocolId,
  payInHelper,
  waitForWalletPayment,
  isStopped
}) {
  const newPayIn = await payInHelper.retry(payIn, { sendProtocolId })
  const hasBolt11 = !!newPayIn.payerPrivates.payInBolt11
  if (isStopped()) {
    // Release the successor attempt so it can be retried again later.
    if (hasBolt11) {
      await payInHelper.cancel(newPayIn).catch(() => {})
    }
    return
  }

  // if the payIn has no bolt11, there's nothing to retry
  if (!hasBolt11) {
    return
  }

  try {
    await waitForWalletPayment(newPayIn)
  } catch (err) {
    if (isStopped()) {
      // Stop/pause events should not strand the new attempt in a pending state.
      await payInHelper.cancel(newPayIn).catch(() => {})
      return
    }
    if (err instanceof WalletConfigurationError) {
      // consume attempt by canceling invoice
      await payInHelper.cancel(newPayIn)
    }
    throw err
  }
}
