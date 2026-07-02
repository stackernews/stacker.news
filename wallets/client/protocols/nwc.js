import { NWC_LOOKUP_INVOICE_METHOD, NWC_PAY_INVOICE_METHOD, getBalance as getNwcBalance, supportedMethods, nwcTryRun } from '@/wallets/lib/protocols/nwc'
import { WalletPaymentRejectedError, WalletPermissionsError } from '@/wallets/client/errors'
import { EXTERNAL_TRANSACTION_UNKNOWN_REASONS, verificationUnsupportedResult } from '@/wallets/lib/external-transactions'
import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'
import { walletBalance } from './util'

export const name = 'NWC'
// NIP-47 pay_invoice has no standardized per-payment fee cap; wallets enforce
// their own daily/transaction budgets. We do not pretend to cap fees here.
export const enforcesMaxFee = false

// PAYMENT_FAILED is excluded: wallets may emit it while HTLCs are still in flight.
const NWC_TERMINAL_PAYMENT_ERROR_CODES = new Set([
  'INSUFFICIENT_BALANCE',
  'QUOTA_EXCEEDED',
  'NOT_FOUND',
  'NOT_IMPLEMENTED',
  'UNSUPPORTED_ENCRYPTION',
  'RATE_LIMITED'
])

export async function sendPayment (bolt11, { url }, { signal }) {
  try {
    // NDK's lnPay discards result fields other than preimage.
    const res = await nwcTryRun(nwc => nwc.req(NWC_PAY_INVOICE_METHOD, { invoice: bolt11 }), { url }, { signal })
    const result = res?.result
    return {
      // Some wallets misuse preimage; verifyPreimage decides if it is proof.
      preimage: result?.preimage,
      actualFeeMsats: walletAmountToMsatsOrUndefined(result?.fees_paid)
    }
  } catch (err) {
    // Only explicit terminal NIP-47 payment failures are safe to retry. INTERNAL,
    // OTHER, and unknown codes may be reported after the wallet submitted HTLCs.
    if (isNwcTerminalPaymentError(err)) throw new WalletPaymentRejectedError(err.message)
    throw err
  }
}

export async function checkPayment ({ hash }, { url }, { signal }) {
  // no supportedMethods pre-probe: each nwcTryRun opens a fresh relay connection, so probing
  // doubles relay round trips per poll. NOT_IMPLEMENTED/RESTRICTED errors from lookup_invoice
  // itself already classify unsupported/unauthorized wallets.
  let result
  try {
    result = await nwcTryRun(
      nwc => nwc.req(NWC_LOOKUP_INVOICE_METHOD, { payment_hash: hash }),
      { url },
      { signal }
    )
  } catch (err) {
    const unavailable = nwcOutgoingLookupInvoiceError(err)
    if (unavailable) return unavailable
    throw err
  }

  return nwcOutgoingLookupInvoiceResult(result.result)
}

export function nwcOutgoingLookupInvoiceResult (invoice) {
  if (!invoice) {
    return {
      status: 'UNKNOWN',
      unknownReason: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.STATUS_UNAVAILABLE,
      error: 'nwc lookup_invoice returned no invoice'
    }
  }

  if (invoice.state === 'settled' && !invoice.preimage) {
    return {
      status: 'UNKNOWN',
      unknownReason: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.PROOF_UNAVAILABLE,
      error: 'nwc lookup_invoice reported settled without preimage'
    }
  }

  // NIP-47 marks `state` optional on lookup_invoice; many wallets signal completion of an
  // outgoing payment via preimage + settled_at without a `state`. Treat a present preimage
  // as settled so proof recovery doesn't silently no-op on those wallets.
  if (invoice.preimage && (invoice.state === 'settled' || !invoice.state)) {
    return {
      status: 'SETTLED',
      preimage: invoice.preimage,
      actualFeeMsats: walletAmountToMsatsOrUndefined(invoice.fees_paid),
      settledAt: invoice.settled_at ? new Date(invoice.settled_at * 1000) : undefined
    }
  }

  // An outgoing lookup_invoice `state` is NOT a reliable terminal signal: `expired` is an
  // invoice-timer state (an HTLC launched just before expiry can still settle), and `failed` isn't
  // standardized in NIP-47 for outgoing payments and is wallet-dependent. Don't burn the send to
  // terminal FAILED on either - keep it UNKNOWN so it stays reconcilable and we don't invite a double-pay.
  if (['expired', 'failed'].includes(invoice.state)) {
    return {
      status: 'UNKNOWN',
      error: `nwc lookup_invoice reported ${invoice.state}; the payment may still be settleable`
    }
  }

  return { status: 'PENDING' }
}

export function nwcOutgoingLookupInvoiceError (err) {
  if (err?.nwcError?.code === 'NOT_IMPLEMENTED') {
    return verificationUnsupportedResult(err.message || 'nwc wallet does not support lookup_invoice')
  }
  if (err?.nwcError?.code === 'NOT_FOUND') {
    return {
      status: 'UNKNOWN',
      unknownReason: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.STATUS_UNAVAILABLE,
      error: err.message || 'nwc lookup_invoice did not find this payment'
    }
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
