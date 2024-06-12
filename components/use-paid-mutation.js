import { useApolloClient, useMutation } from '@apollo/client'
import { useCallback, useState } from 'react'
import { InvoiceCanceledError, InvoiceExpiredError, useQrPayment, useWebLnPayment } from './payment'

// this is just like useMutation with a few changes:
// 1. pays an invoice returned by the mutation
// 2. takes an onPaid and onPayError callback
// 3. for a pessimistic update, does not call onCompleted until the invoice is paid
// So, if you want to know when to
export function usePaidMutation (mutation, { onCompleted, ...options }) {
  options.optimisticResponse = addOptimisticResponseExtras(options.optimisticResponse)
  const [mutate, result] = useMutation(mutation, options)
  const waitForWebLnPayment = useWebLnPayment()
  const waitForQrPayment = useQrPayment()
  const client = useApolloClient()
  // innerResult is used to store/control the result of the mutation when innerMutate runs
  const [innerResult, setInnerResult] = useState(result)

  const waitForPayment = useCallback(async invoice => {
    let webLnError
    const start = Date.now()
    try {
      return await waitForWebLnPayment(invoice)
    } catch (err) {
      if (Date.now() - start > 1000 || err instanceof InvoiceCanceledError || err instanceof InvoiceExpiredError) {
        // bail since qr code payment will also fail
        // also bail if the payment took more than 1 second
        throw err
      }
      webLnError = err
    }
    return await waitForQrPayment(invoice, webLnError)
  }, [waitForWebLnPayment, waitForQrPayment])

  const innerMutate = useCallback(async ({ onCompleted: innerOnCompleted, ...innerOptions }) => {
    innerOptions.optimisticResponse = addOptimisticResponseExtras(innerOptions.optimisticResponse)
    const { onPaid, onPayError } = { ...options, ...innerOptions }
    const ourOnCompleted = innerOnCompleted || onCompleted
    const { data } = await mutate(innerOptions)

    // get invoice without knowing the mutation name
    if (Object.values(data).length !== 1) {
      throw new Error('usePaidMutation: exactly one mutation at a time is supported')
    }
    const response = Object.values(data)[0]
    const invoice = response?.invoice

    // if the mutation returns an invoice, pay it
    if (invoice) {
      // should we wait for the invoice to be paid?
      const optimistic = response?.paymentMethod === 'OPTIMISTIC'

      // pay the invoice in a promise
      const pay = async () => {
        await waitForPayment(invoice)
        let otherData = { data }
        if (!optimistic) {
          // this is a pessimistic update
          otherData = await mutate({
            ...innerOptions,
            variables: {
              ...options.variables,
              ...innerOptions.variables,
              hmac: invoice.hmac,
              hash: invoice.hash
            }
          })
        }
        // onPaid resembles update in useMutation, but is called after the invoice is paid
        // useful for updating invoiceActionState to PAID
        setInnerResult(otherData)
        onPaid?.(client.cache, otherData)
        return otherData
      }

      // if this is an optimistic update, don't wait to pay the invoice
      if (optimistic) {
        // onCompleted is called before the invoice is paid for optimistic updates
        ourOnCompleted?.(data)
        pay().catch(e => {
          console.error('usePaidMutation: failed to pay invoice', e)
          // onPayError is called after the invoice fails to pay
          // useful for updating invoiceActionState to FAILED
          onPayError?.(e, client.cache, { data })
        })
      } else {
        // otherwise, wait for to pay before completing the mutation
        try {
          const { data } = await pay()
          // onCompleted is called after the invoice is paid for pessimistic updates
          ourOnCompleted?.(data)
        } catch (e) {
          console.error('usePaidMutation: failed to pay invoice', e)
          onPayError?.(e, client.cache, { data })
        }
      }
    } else {
      // fee credits paid for it
      ourOnCompleted?.(data)
      setInnerResult({ data })
      onPaid?.(client.cache, { data })
    }

    return { data }
  }, [mutate, options, waitForPayment])

  return [innerMutate, innerResult]
}

// all paid actions need these fields and they're easy to forget
function addOptimisticResponseExtras (optimisticResponse) {
  if (!optimisticResponse) return optimisticResponse
  const key = Object.keys(optimisticResponse)[0]
  optimisticResponse[key] = { invoice: null, paymentMethod: 'OPTIMISTIC', ...optimisticResponse[key] }
  return optimisticResponse
}
