import { NWC_PAY_INVOICE_METHOD, getBalance as getNwcBalance, supportedMethods, nwcTryRun } from '@/wallets/lib/protocols/nwc'
import { WalletPermissionsError } from '@/wallets/client/errors'
import { walletBalance } from './util'

export const name = 'NWC'
// NIP-47 pay_invoice has no standardized per-payment fee cap; wallets enforce
// their own daily/transaction budgets. We do not pretend to cap fees here.
export const enforcesMaxFee = false

export async function sendPayment (bolt11, { url }, { signal }) {
  const result = await nwcTryRun(nwc => nwc.lnPay({ pr: bolt11 }), { url }, { signal })
  return result.preimage
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
