import { useCallback } from 'react'
import { AnonWalletError, InvoiceCanceledError } from '@/wallets/client/errors'
import { useShowModal } from '@/components/modal'
import usePayInHelper from '@/components/payIn/hooks/use-pay-in-helper'
import { sendPayment as weblnSendPayment } from '@/wallets/client/protocols/webln'
import useWatchPayIn from './use-watch-pay-in'
import Qr, { QrSkeleton } from '@/components/qr'
import PayInError from '../error'
import { msatsToSats, numWithUnits } from '@/lib/format'
import { paidWaitFor } from '@/lib/pay-in'
import { PayInStatus } from '../status'

export default function useQrPayIn () {
  const payInHelper = usePayInHelper()
  const showModal = useShowModal()

  const waitForQrPayIn = useCallback(async (payIn, walletError,
    {
      keepOpen = true,
      cancelOnClose = true,
      persistOnNavigate = false,
      waitFor = paidWaitFor
    } = {}
  ) => {
    // if anon user and webln is available, try to pay with webln
    if (typeof window.webln !== 'undefined' && (walletError instanceof AnonWalletError)) {
      weblnSendPayment(payIn.payerPrivates.payInBolt11.bolt11).catch(e => { console.error('WebLN payment failed:', e) })
    }
    return await new Promise((resolve, reject) => {
      let updatedPayIn
      const cancelAndReject = async (onClose) => {
        if (!updatedPayIn && cancelOnClose) {
          // always settle the promise, even if the cancel mutation throws (e.g. offline),
          // else the submitting form awaits forever
          try {
            const cancelledPayIn = await payInHelper.cancel(payIn, { userCancel: true })
            if (cancelledPayIn) {
              reject(new InvoiceCanceledError(cancelledPayIn.payerPrivates.payInBolt11))
              return
            }
            // cancel no-oped because the payIn already reached a terminal state — it may have
            // been PAID in the instant before the close, in which case the action committed and
            // the payer was charged, so reporting a cancel would invite a double pay. check()
            // throws for the terminal failure states (expired/cancelled/receiver failure).
            const { payIn: latestPayIn, check } = await payInHelper.check(payIn.id, waitFor)
            if (check) {
              resolve(latestPayIn)
              return
            }
            reject(new InvoiceCanceledError(latestPayIn?.payerPrivates?.payInBolt11 ?? payIn.payerPrivates.payInBolt11))
          } catch (err) {
            reject(err)
          }
          return
        }
        resolve(updatedPayIn)
      }
      showModal(onClose =>
        <QrPayIn
          id={payIn.id}
          walletError={walletError}
          waitFor={waitFor}
          onPaymentError={err => {
            if (err instanceof InvoiceCanceledError) {
              onClose()
              reject(err)
            } else {
              reject(err)
            }
          }}
          onPaymentSuccess={(payIn) => {
            updatedPayIn = payIn
            // this onClose will resolve the promise before the subsequent line runs
            // so we need to set updatedPayIn first
            onClose()
            resolve(payIn)
          }}
        />,
      { keepOpen, persistOnNavigate, onClose: cancelAndReject })
    })
  }, [payInHelper, showModal])

  return waitForQrPayIn
}

function QrPayIn ({
  id, onPaymentError, onPaymentSuccess, waitFor, walletError
}) {
  const { data, error } = useWatchPayIn({ id, onPaymentError, onPaymentSuccess, waitFor })

  const payIn = data?.payIn

  if (error) {
    return <div>{error.message}</div>
  }

  // a creation-/wrap-failed payIn has no bolt11 to render (see isInvoiceSetupPending),
  // and item-info's 'pending' link can open this modal with one
  if (!payIn || !payIn.payerPrivates?.payInBolt11) {
    return <QrSkeleton description />
  }

  const { bolt11 } = payIn.payerPrivates.payInBolt11

  return (
    <>
      <PayInError error={walletError} />
      <Qr
        value={bolt11}
        qrTransform={value => 'lightning:' + value.toUpperCase()}
        description={numWithUnits(msatsToSats(payIn.payerPrivates.payInBolt11.msatsRequested), { abbreviate: false })}
      />
      <div className='d-flex justify-content-center'>
        <PayInStatus payIn={payIn} />
      </div>
    </>
  )
}
