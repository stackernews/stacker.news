import { useWalletPayment } from '@/wallets/client/hooks'
import usePayInHelper from './use-pay-in-helper'
import useQrPayIn from './use-qr-pay-in'
import { isInvoiceSetupPending } from '@/lib/pay-in'
import { useCallback } from 'react'
import { WalletError, InvoiceCanceledError, InvoiceExpiredError, WalletPaymentError } from '@/wallets/client/errors'

export default function usePayPayIn () {
  const walletPayment = useWalletPayment()
  const payInHelper = usePayInHelper()
  const qrPayIn = useQrPayIn()
  return useCallback(async (payIn, { alwaysShowQROnFailure = false, persistOnNavigate = false, waitFor, onRetry, protocolLimit }) => {
    let walletError
    const start = Date.now()

    try {
      return await walletPayment(payIn, { waitFor, protocolLimit })
    } catch (err) {
      walletError = null
      if (err instanceof WalletError) {
        walletError = err
        // aggregate wallet errors carry the lineage's latest payIn (the last attempted,
        // possibly retried, payIn) as `invoice` — adopt it so the retry/QR fallback below
        // works on the lineage tail instead of an already-superseded payIn. The payInState
        // check excludes errors whose `invoice` is a bolt11 row (sender/receiver errors).
        if (err.invoice?.payInState) payIn = err.invoice
      }

      const invoiceError = err instanceof InvoiceCanceledError || err instanceof InvoiceExpiredError
      if (!invoiceError && !walletError) {
      // unexpected error, rethrow
        throw err
      }

      // bail if the payment took too long to prevent showing a QR code on an unrelated page
      // (if alwaysShowQROnFailure is not set) or user canceled the invoice or it expired
      const tooSlow = Date.now() - start > 3000
      const skipQr = (tooSlow && !alwaysShowQROnFailure) || invoiceError
      if (skipQr) {
        throw err
      }
    }

    const paymentAttempted = walletError instanceof WalletPaymentError
    if (paymentAttempted) {
      // the wallet loop may have bailed with a bolt11-less successor (its invoice
      // creation/wrap failed; it's being driven to FAILED and auto-retried) — it isn't
      // FAILED yet so it can't be retried, and there's no invoice to show a QR for
      if (isInvoiceSetupPending(payIn)) throw walletError
      // QR/manual fallback should not keep attributing the successor invoice
      // to the wallet protocol that already failed to pay it.
      payIn = await payInHelper.retry(payIn, { sendProtocolId: null, update: onRetry })
      // if the retried successor has no invoice (its creation/wrap failed too), there's nothing to
      // show a QR for — surface the original wallet error instead of opening a bolt11-less QR.
      if (isInvoiceSetupPending(payIn)) throw walletError
    }
    return await qrPayIn(payIn, walletError, { persistOnNavigate, waitFor })
  }, [payInHelper, qrPayIn, walletPayment])
}
