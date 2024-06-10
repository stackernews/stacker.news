import { useMutation } from '@apollo/client'
import { useCallback, useState } from 'react'
import { InvoiceCanceledError, InvoiceExpiredError, useQrPayment, useWebLnPayment } from './payment'
import { useMe } from './me'

// this is just like useMutation but it pays an invoice returned by the mutation
// also takes an onPaid and onPayError callback
// and returns a payError in the result
export function usePaidMutation (mutation, { onPaid, onPayError, ...options } = {}) {
  options.optimisticResponse = addOptimisticResponseExtras(options.optimisticResponse)
  const [mutate, result] = useMutation(mutation, options)
  const waitForWebLnPayment = useWebLnPayment()
  const waitForQrPayment = useQrPayment()
  const me = useMe()
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

  const innerMutate = useCallback(async innerOptions => {
    innerOptions.optimisticResponse = addOptimisticResponseExtras(innerOptions.optimisticResponse)
    const { data, ...rest } = await mutate(innerOptions)

    // get invoice without knowing the mutation name
    if (Object.values(data).length !== 1) {
      throw new Error('usePaidMutation: exactly one mutation at a time is supported')
    }
    const response = Object.values(data)[0]
    const invoice = response?.invoice

    // if the mutation returns an invoice, pay it
    if (invoice) {
      // should we wait for the invoice to be paid?
      const optimistic = me && (response?.paymentMethod === 'OPTIMISTIC' || innerOptions.optimisticResponse || options.optimisticResponse)

      // pay the invoice in a promise
      const pay = async () => {
        await waitForPayment(invoice)
        if (!optimistic) {
          // this is a pessimistic update
          return await mutate({
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
        onPaid?.(rest.client.cache, rest)
      }

      // if this is an optimistic update, don't wait to pay the invoice
      if (optimistic) {
        pay().catch(e => {
          console.error('usePaidMutation: failed to pay invoice', e)
          // onPayError is called after the invoice fails to pay
          // useful for updating invoiceActionState to FAILED
          onPayError?.(e, rest.client.cache, data)
          setInnerResult({ data, ...rest, payError: e })
        })
      } else {
        // otherwise, wait for to pay before completing the mutation
        try {
          await pay()
        } catch (e) {
          console.error('usePaidMutation: failed to pay invoice', e)
          onPayError?.(e, rest.client.cache, data)
          rest.payError = e
        }
      }
    }

    setInnerResult({ data, ...rest })
    return { data, ...rest }
  }, [!!me, mutate, waitForPayment, onPaid, options.variables, options.optimisticResponse, setInnerResult])

  return [innerMutate, innerResult]
}

// all paid actions need these fields and they're easy to forget
function addOptimisticResponseExtras (optimisticResponse, me) {
  if (!optimisticResponse) return optimisticResponse
  const key = Object.keys(optimisticResponse)[0]
  optimisticResponse[key] = { invoice: null, paymentMethod: 'OPTIMISTIC', ...optimisticResponse[key] }
  return optimisticResponse
}
