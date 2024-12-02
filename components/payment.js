import { useCallback } from 'react'
import { useApolloClient, useMutation } from '@apollo/client'
import { CANCEL_INVOICE, INVOICE } from '@/fragments/wallet'
import Invoice from '@/components/invoice'
import { useShowModal } from './modal'
import { InvoiceCanceledError, InvoiceExpiredError } from '@/wallets/errors'
import { RETRY_PAID_ACTION } from '@/fragments/paidAction'

export const useInvoice = () => {
  const client = useApolloClient()
  const [retryPaidAction] = useMutation(RETRY_PAID_ACTION)

  const [cancelInvoice] = useMutation(CANCEL_INVOICE)

  const isInvoice = useCallback(async ({ id }, that) => {
    const { data, error } = await client.query({ query: INVOICE, fetchPolicy: 'network-only', variables: { id } })
    if (error) {
      throw error
    }

    const { cancelled, cancelledAt, actionError, actionState, expiresAt } = data.invoice

    const expired = cancelledAt && new Date(expiresAt) < new Date(cancelledAt)
    if (expired) {
      throw new InvoiceExpiredError(data.invoice)
    }

    if (cancelled || actionError) {
      throw new InvoiceCanceledError(data.invoice, actionError)
    }

    // write to cache if paid
    if (actionState === 'PAID') {
      client.writeQuery({ query: INVOICE, variables: { id }, data: { invoice: data.invoice } })
    }

    return { invoice: data.invoice, check: that(data.invoice) }
  }, [client])

  const cancel = useCallback(async ({ id, hash, hmac }) => {
    console.log('canceling invoice:', id || hash)
    const { data } = await cancelInvoice({ variables: { id, hash, hmac } })
    return data.cancelInvoice
  }, [cancelInvoice])

  const retry = useCallback(async ({ id, hash, hmac }, { update } = {}) => {
    console.log('retrying invoice:', id || hash)
    const { data, error } = await retryPaidAction({ variables: { invoiceId: Number(id) }, update })
    if (error) throw error

    const newInvoice = data.retryPaidAction.invoice
    console.log('new invoice:', newInvoice?.hash)

    return newInvoice
  }, [retryPaidAction])

  return { cancel, retry, isInvoice }
}

export const useQrPayment = () => {
  const invoice = useInvoice()
  const showModal = useShowModal()

  const waitForQrPayment = useCallback(async (inv, walletError,
    {
      keepOpen = true,
      cancelOnClose = true,
      persistOnNavigate = false,
      waitFor = inv => inv?.satsReceived > 0,
      retry = true
    } = {}
  ) => {
    let qrInv = inv

    if (retry) {
      await invoice.cancel(inv)
      qrInv = await invoice.retry(inv)
    }

    return await new Promise((resolve, reject) => {
      let paid
      const cancelAndReject = async (onClose) => {
        if (!paid && cancelOnClose) {
          const updatedInv = await invoice.cancel(qrInv).catch(console.error)
          reject(new InvoiceCanceledError(updatedInv))
        }
        resolve(qrInv)
      }
      showModal(onClose =>
        <Invoice
          id={qrInv.id}
          modal
          description
          status='loading'
          successVerb='received'
          walletError={walletError}
          waitFor={waitFor}
          onExpired={expiredInv => reject(new InvoiceExpiredError(expiredInv))}
          onCanceled={canceledInv => { onClose(); reject(new InvoiceCanceledError(canceledInv, canceledInv?.actionError)) }}
          onPayment={(paidInv) => { paid = true; onClose(); resolve(paidInv) }}
          poll
        />,
      { keepOpen, persistOnNavigate, onClose: cancelAndReject })
    })
  }, [invoice])

  return waitForQrPayment
}
