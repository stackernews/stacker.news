import { useCallback } from 'react'
import PayIn from '@/components/payIn'
import { AnonWalletError, InvoiceCanceledError } from '@/wallets/client/errors'
import { useShowModal } from '@/components/modal'
import usePayInHelper from '@/components/payIn/hooks/use-pay-in-helper'
import { sendPayment as weblnSendPayment } from '@/wallets/client/protocols/webln'

export default function useQrPayIn () {
  const payInHelper = usePayInHelper()
  const showModal = useShowModal()

  const waitForQrPayIn = useCallback(async (payIn, walletError,
    {
      keepOpen = true,
      cancelOnClose = true,
      persistOnNavigate = false,
      waitFor = payIn => payIn?.payInState === 'PAID'
    } = {}
  ) => {
    // if anon user and webln is available, try to pay with webln
    if (typeof window.webln !== 'undefined' && (walletError instanceof AnonWalletError)) {
      weblnSendPayment(payIn.payInBolt11.bolt11).catch(e => { console.error('WebLN payment failed:', e) })
    }
    return await new Promise((resolve, reject) => {
      console.log('waitForQrPayIn', payIn.id, walletError)
      let updatedPayIn
      const cancelAndReject = async (onClose) => {
        console.log('waitForQrPayIn: cancelAndReject', payIn.id, updatedPayIn, cancelOnClose)
        if (!updatedPayIn && cancelOnClose) {
          const updatedPayIn = await payInHelper.cancel(payIn, { userCancel: true })
          reject(new InvoiceCanceledError(updatedPayIn?.payInBolt11))
        }
        resolve(updatedPayIn)
      }
      showModal(onClose =>
        <PayIn
          id={payIn.id}
          walletError={walletError}
          waitFor={waitFor}
          onPaymentError={err => {
            console.log('waitForQrPayIn: onPaymentError', err)
            if (err instanceof InvoiceCanceledError) {
              onClose()
              reject(err)
            } else {
              reject(err)
            }
          }}
          onPaymentSuccess={(payIn) => {
            console.log('waitForQrPayIn: onPaymentSuccess', payIn)
            updatedPayIn = payIn
            // this onClose will resolve the promise before the subsequent line runs
            // so we need to set updatedPayIn first
            onClose()
            resolve(payIn)
          }}
        />,
      { keepOpen, persistOnNavigate, onClose: cancelAndReject })
    })
  }, [payInHelper])

  return waitForQrPayIn
}
