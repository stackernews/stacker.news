import { useCallback } from 'react'
import Invoice from '@/components/invoice'
import { InvoiceCanceledError, InvoiceExpiredError } from '@/wallets/client/errors'
import { useShowModal } from '@/components/modal'
import useInvoice from '@/components/use-invoice'

export default function useQrPayment () {
  const invoice = useInvoice()
  const showModal = useShowModal()

  const waitForQrPayment = useCallback(async (inv, walletError,
    {
      keepOpen = true,
      cancelOnClose = true,
      persistOnNavigate = false,
      waitFor = inv => inv?.satsReceived > 0
    } = {}
  ) => {
    // TODO(wallet-v2): implement this
    // if anon user and webln is available, try to pay with webln
    // if (typeof window.webln !== 'undefined' && (walletError instanceof AnonWalletError)) {
    //   sendPayment(inv.bolt11).catch(e => { console.error('WebLN payment failed:', e) })
    // }
    return await new Promise((resolve, reject) => {
      let paid
      const cancelAndReject = async (onClose) => {
        if (!paid && cancelOnClose) {
          const updatedInv = await invoice.cancel(inv, { userCancel: true })
          reject(new InvoiceCanceledError(updatedInv))
        }
        resolve(inv)
      }
      showModal(onClose =>
        <Invoice
          id={inv.id}
          modal
          description
          status='loading'
          successVerb='received'
          walletError={walletError}
          waitFor={waitFor}
          onExpired={inv => reject(new InvoiceExpiredError(inv))}
          onCanceled={inv => { onClose(); reject(new InvoiceCanceledError(inv, inv?.actionError)) }}
          onPayment={(inv) => { paid = true; onClose(); resolve(inv) }}
          poll
        />,
      { keepOpen, persistOnNavigate, onClose: cancelAndReject })
    })
  }, [invoice])

  return waitForQrPayment
}
