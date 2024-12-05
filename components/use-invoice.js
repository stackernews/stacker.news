import { useApolloClient, useMutation } from '@apollo/client'
import { useCallback } from 'react'
import { RETRY_PAID_ACTION } from '@/fragments/paidAction'
import { INVOICE, CANCEL_INVOICE } from '@/fragments/wallet'
import { InvoiceExpiredError, InvoiceCanceledError } from '@/wallets/errors'

export default function useInvoice () {
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

  const cancel = useCallback(async ({ hash, hmac }) => {
    if (!hash || !hmac) {
      throw new Error('missing hash or hmac')
    }

    console.log('canceling invoice:', hash)
    const { data } = await cancelInvoice({ variables: { hash, hmac } })
    return data.cancelInvoice
  }, [cancelInvoice])

  const retry = useCallback(async ({ id, hash, hmac }, { update }) => {
    console.log('retrying invoice:', hash)
    const { data, error } = await retryPaidAction({ variables: { invoiceId: Number(id) }, update })
    if (error) throw error

    const newInvoice = data.retryPaidAction.invoice
    console.log('new invoice:', newInvoice?.hash)

    return newInvoice
  }, [retryPaidAction])

  return { cancel, retry, isInvoice }
}
