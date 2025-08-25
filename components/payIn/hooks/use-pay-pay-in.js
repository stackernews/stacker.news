import { useWalletPayment } from '@/wallets/client/hooks'
import usePayInHelper from './use-pay-in-helper'
import useQrPayIn from './use-qr-pay-in'
import { useCallback } from 'react'
import { WalletError, InvoiceCanceledError, InvoiceExpiredError, WalletPaymentError } from '@/wallets/client/errors'

export default function usePayPayIn () {
  const walletPayment = useWalletPayment()
  const payInHelper = usePayInHelper()
  const qrPayIn = useQrPayIn()
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
      walletInvoice = await payInHelper.retry(walletInvoice, { update: updateOnFallback })
    }
    console.log('usePayPayIn: qrPayIn', payIn.id, walletError)
    return await qrPayIn(payIn, walletError, { persistOnNavigate, waitFor })
  }, [payInHelper, qrPayIn, walletPayment])
}
