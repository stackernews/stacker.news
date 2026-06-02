import { NWC_PAY_INVOICE_METHOD, getBalance as getNwcBalance, supportedMethods, nwcTryRun } from '@/wallets/lib/protocols/nwc'
import { WalletPaymentRejectedError, WalletPermissionsError } from '@/wallets/client/errors'
import { walletBalance } from './util'

export const name = 'NWC'
// NIP-47 pay_invoice has no standardized per-payment fee cap; wallets enforce
// their own daily/transaction budgets. We do not pretend to cap fees here.
export const enforcesMaxFee = false

const NWC_TERMINAL_PAYMENT_ERROR_CODES = new Set([
  'PAYMENT_FAILED',
  'INSUFFICIENT_BALANCE',
  'QUOTA_EXCEEDED',
  'NOT_FOUND',
  'NOT_IMPLEMENTED',
  'UNSUPPORTED_ENCRYPTION',
  'RATE_LIMITED'
])

export async function sendPayment (bolt11, { url }, { signal }) {
  try {
    const result = await nwcTryRun(nwc => nwc.lnPay({ pr: bolt11 }), { url }, { signal })
    return result.preimage
  } catch (err) {
    // Only explicit terminal NIP-47 payment failures are safe to retry. INTERNAL,
    // OTHER, and unknown codes may be reported after the wallet submitted HTLCs.
    if (isNwcTerminalPaymentError(err)) throw new WalletPaymentRejectedError(err.message)
    throw err
  }
}

function isNwcTerminalPaymentError (err) {
  return NWC_TERMINAL_PAYMENT_ERROR_CODES.has(err?.nwcError?.code)
}

export async function testSendPayment ({ url }, { signal }) {
  const supported = await supportedMethods(url, { signal })
  if (!supported.includes(NWC_PAY_INVOICE_METHOD)) {
    throw new WalletPermissionsError('credentials do not allow spending')
  }
}

export async function getBalance ({ url }, { signal } = {}) {
  const balance = await getNwcBalance(url, { signal })
  // The shared NWC helper converts NIP-47 millisats to sats.
  return walletBalance(balance)
}
