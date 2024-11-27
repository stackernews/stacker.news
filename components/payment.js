import { useCallback } from 'react'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import { INVOICE } from '@/fragments/wallet'
import Invoice from '@/components/invoice'
import { useShowModal } from './modal'
import { InvoiceCanceledError, InvoiceExpiredError } from '@/wallets/errors'
import { RETRY_PAID_ACTION } from '@/fragments/paidAction'

export const useInvoice = () => {
  const client = useApolloClient()
  const [retryPaidAction] = useMutation(RETRY_PAID_ACTION)

  const [cancelInvoice] = useMutation(gql`
    mutation cancelInvoice($hash: String!, $hmac: String!) {
      cancelInvoice(hash: $hash, hmac: $hmac) {
        id
      }
    }
  `)

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

    return that(data.invoice)
  }, [client])

  const cancel = useCallback(async ({ hash, hmac }) => {
    if (!hash || !hmac) {
      throw new Error('missing hash or hmac')
    }

    console.log('canceling invoice:', hash)
    const inv = await cancelInvoice({ variables: { hash, hmac } })
    return inv
  }, [cancelInvoice])

  const retry = useCallback(async ({ id, hash, hmac }) => {
    console.log('retrying invoice:', hash)
    const { data, error } = await retryPaidAction({ variables: { invoiceId: Number(id) } })
    if (error) throw error

    const newInvoice = data.retryPaidAction.invoice
    console.log('new invoice:', newInvoice?.hash)

    return newInvoice
  })

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
      waitFor = inv => inv?.satsReceived > 0
    } = {}
  ) => {
    return await new Promise((resolve, reject) => {
      let paid
      const cancelAndReject = async (onClose) => {
        if (!paid && cancelOnClose) {
          await invoice.cancel(inv).catch(console.error)
          reject(new InvoiceCanceledError(inv))
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
          onPayment={() => { paid = true; onClose(); resolve(inv) }}
          poll
        />,
      { keepOpen, persistOnNavigate, onClose: cancelAndReject })
    })
  }, [invoice])

  return waitForQrPayment
}
