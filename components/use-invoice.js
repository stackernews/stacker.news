import { useApolloClient, useMutation } from '@apollo/client'
import { useCallback, useMemo } from 'react'
import { InvoiceCanceledError, InvoiceExpiredError, WalletReceiverError } from '@/wallets/client/errors'
import { RETRY_PAID_ACTION } from '@/fragments/paidAction'
import { INVOICE, CANCEL_INVOICE } from '@/fragments/wallet'

export default function useInvoice () {
  const client = useApolloClient()
  const [retryPaidAction] = useMutation(RETRY_PAID_ACTION)

  const [cancelInvoice] = useMutation(CANCEL_INVOICE)

  const isInvoice = useCallback(async ({ id }, that) => {
    const { data, error } = await client.query({ query: INVOICE, fetchPolicy: 'network-only', variables: { id } })
    if (error) {
      throw error
    }

    const { cancelled, cancelledAt, actionError, expiresAt, forwardStatus } = data.invoice

    const expired = cancelledAt && new Date(expiresAt) < new Date(cancelledAt)
    if (expired) {
      throw new InvoiceExpiredError(data.invoice)
    }

    const failedForward = forwardStatus && forwardStatus !== 'CONFIRMED'
    if (failedForward) {
      throw new WalletReceiverError(data.invoice)
    }

    const failed = cancelled || actionError
    if (failed) {
      throw new InvoiceCanceledError(data.invoice, actionError)
    }

    return { invoice: data.invoice, check: that(data.invoice) }
  }, [client])

  const cancel = useCallback(async ({ hash, hmac }, { userCancel = false } = {}) => {
    console.log('canceling invoice:', hash)
    const { data } = await cancelInvoice({ variables: { hash, hmac, userCancel } })
    return data.cancelInvoice
  }, [cancelInvoice])

  const retry = useCallback(async ({ id, hash, hmac, newAttempt = false }, { update } = {}) => {
    console.log('retrying invoice:', hash)
    const { data, error } = await retryPaidAction({ variables: { invoiceId: Number(id), newAttempt }, update })
    if (error) throw error

    const newInvoice = data.retryPaidAction.invoice
    console.log('new invoice:', newInvoice?.hash)

    return newInvoice
  }, [retryPaidAction])

  return useMemo(() => ({ cancel, retry, isInvoice }), [cancel, retry, isInvoice])
}
