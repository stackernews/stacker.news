import { useWalletPayment } from '@/wallets/payment'
import useInvoice from './use-invoice'
import useQrPayment from './use-qr-payment'
import { useCallback } from 'react'
import { WalletError, InvoiceCanceledError, InvoiceExpiredError, WalletPaymentError } from '@/wallets/errors'

export function useWaitForPayIn () {
  const walletPayment = useWalletPayment()
  const invoiceHelper = useInvoice()
  const waitForQrPayment = useQrPayment()
  return useCallback(async (payIn, { alwaysShowQROnFailure = false, persistOnNavigate = false, waitFor, updateOnFallback }) => {
    let walletError
    let walletInvoice = payIn.payInBolt11.bolt11
    const start = Date.now()

    try {
      return await walletPayment(walletInvoice, { waitFor, updateOnFallback })
    } catch (err) {
      walletError = null
      if (err instanceof WalletError) {
        walletError = err
        // get the last invoice that was attempted but failed and was canceled
        if (err.invoice) walletInvoice = err.invoice
      }

      const invoiceError = err instanceof InvoiceCanceledError || err instanceof InvoiceExpiredError
      if (!invoiceError && !walletError) {
      // unexpected error, rethrow
        throw err
      }

      // bail if the payment took too long to prevent showing a QR code on an unrelated page
      // (if alwaysShowQROnFailure is not set) or user canceled the invoice or it expired
      const tooSlow = Date.now() - start > 1000
      const skipQr = (tooSlow && !alwaysShowQROnFailure) || invoiceError
      if (skipQr) {
        throw err
      }
    }

    const paymentAttempted = walletError instanceof WalletPaymentError
    if (paymentAttempted) {
      walletInvoice = await invoiceHelper.retry(walletInvoice, { update: updateOnFallback })
    }
    return await waitForQrPayment(walletInvoice, walletError, { persistOnNavigate, waitFor })
  }, [invoiceHelper, waitForQrPayment, walletPayment])
}
