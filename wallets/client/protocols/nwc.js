import { NWC_PAY_INVOICE_METHOD, getBalance as getNwcBalance, supportedMethods, nwcTryRun, nwcLookupInvoice, nwcLookupUnsupported, nwcLookupNotFound } from '@/wallets/lib/protocols/nwc'
import { WalletPaymentRejectedError, WalletPermissionsError } from '@/wallets/client/errors'
import { verificationUnsupportedResult } from '@/wallets/lib/external-transactions'
import { walletBalance } from './util'

export const name = 'NWC'
// NIP-47 pay_invoice has no standardized per-payment fee cap; wallets enforce
// their own daily/transaction budgets. We do not pretend to cap fees here.
export const enforcesMaxFee = false

// NIP-47 calls PAYMENT_FAILED terminal, but deployed wallets have emitted it for
// hold/in-flight payments (for example, ZeusLN/zeus#4146). Keep it ambiguous
// rather than risk making a second payment while the first can still settle.
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
    if (!result?.preimage) return { status: 'PENDING' }

    return {
      status: 'SETTLED',
      preimage: result.preimage,
      // already msats; the classifier validates amounts
      actualFeeMsats: result?.fees_paid
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
  let invoice
  try {
    invoice = await nwcLookupInvoice(hash, { url }, { signal })
  } catch (err) {
    const unavailable = nwcOutgoingLookupInvoiceError(err)
    if (unavailable) return unavailable
    throw err
  }

  return nwcOutgoingLookupInvoiceResult(invoice)
}

export function nwcOutgoingLookupInvoiceResult (invoice) {
  if (!invoice) {
    return { status: 'UNKNOWN', detail: 'nwc lookup_invoice returned no invoice' }
  }
  if (invoice.type !== 'outgoing') {
    return {
      status: 'UNKNOWN',
      detail: 'nwc lookup_invoice did not return an outgoing payment'
    }
  }

  // NIP-47 marks `state` optional on lookup_invoice; many wallets signal completion of an
  // outgoing payment via preimage + settled_at without a `state`. Treat a present preimage
  // as settled so provider settlement does not silently no-op on those wallets.
  if (invoice.state === 'settled' || (invoice.preimage && !invoice.state)) {
    return {
      status: 'SETTLED',
      preimage: invoice.preimage,
      // already msats; the classifier validates amounts
      actualFeeMsats: invoice.fees_paid,
      settledAt: { seconds: invoice.settled_at }
    }
  }

  // An outgoing lookup_invoice `state` is NOT a reliable terminal signal: `expired` is an
  // invoice-timer state (an HTLC launched just before expiry can still settle), and `failed` isn't
  // standardized in NIP-47 for outgoing payments and is wallet-dependent. Don't burn the send to
  // terminal FAILED on either - keep it UNKNOWN so it stays reconcilable and we don't invite a double-pay.
  if (['expired', 'failed'].includes(invoice.state)) {
    return {
      status: 'UNKNOWN',
      detail: `nwc lookup_invoice reported ${invoice.state}; the payment may still be settleable`
    }
  }

  return { status: 'PENDING' }
}

export function nwcOutgoingLookupInvoiceError (err) {
  if (nwcLookupUnsupported(err)) {
    return verificationUnsupportedResult(err.message || 'nwc wallet does not support lookup_invoice')
  }
  if (nwcLookupNotFound(err)) {
    return { status: 'UNKNOWN', detail: err.message || 'nwc lookup_invoice did not find this payment' }
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
