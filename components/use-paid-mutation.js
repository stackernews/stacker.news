import { useApolloClient, useMutation } from '@apollo/client'
import { useCallback, useState } from 'react'
import { InvoiceCanceledError, InvoiceExpiredError, useQrPayment, useWebLnPayment } from './payment'

/*
this is just like useMutation with a few changes:
1. pays an invoice returned by the mutation
2. takes an onPaid and onPayError callback
3. onCompleted behaves a little diffferently, but analogously to useMutation, ie clientside side effects
  of completion can still rely on it
  a. it's called before the invoice is paid for optimistic updates
  b. it's called after the invoice is paid for pessimistic updates
4. we return a payError field in the result object if the invoice fails to pay
*/
export function usePaidMutation (mutation, { onCompleted, ...options } = {}) {
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

  const innerMutate = useCallback(async ({ onCompleted: innerOnCompleted, ...innerOptions } = {}) => {
    innerOptions.optimisticResponse = addOptimisticResponseExtras(innerOptions.optimisticResponse)
    let { data, ...rest } = await mutate(innerOptions)

    // use the most inner callbacks if they exist
    const { onPaid, onPayError } = { ...options, ...innerOptions }
    const ourOnCompleted = innerOnCompleted || onCompleted

    // get invoice without knowing the mutation name
    if (Object.values(data).length !== 1) {
      throw new Error('usePaidMutation: exactly one mutation at a time is supported')
    }
    const response = Object.values(data)[0]
    const invoice = response?.invoice

    // if the mutation returns an invoice, pay it
    if (invoice) {
      // should we wait for the invoice to be paid?
      if (response?.paymentMethod === 'OPTIMISTIC') {
        // onCompleted is called before the invoice is paid for optimistic updates
        ourOnCompleted?.(data)
        // don't wait to pay the invoice
        waitForPayment(invoice).then(() => {
          onPaid?.(client.cache, { data })
        }).catch(e => {
          console.error('usePaidMutation: failed to pay invoice', e)
          // onPayError is called after the invoice fails to pay
          // useful for updating invoiceActionState to FAILED
          onPayError?.(e, client.cache, { data })
          setInnerResult(r => ({ error: e, payError: e, ...r }))
        })
      } else {
        try {
          // wait for the invoice to be paid
          await waitForPayment(invoice);
          // and the mutation to complete
          ({ data, ...rest } = await mutate({
            ...innerOptions,
            variables: {
              ...options.variables,
              ...innerOptions.variables,
              hmac: invoice.hmac,
              hash: invoice.hash
            }
          }))
          ourOnCompleted?.(data)
          onPaid?.(client.cache, { data })
        } catch (e) {
          console.error('usePaidMutation: failed to pay invoice', e)
          onPayError?.(e, client.cache, { data })
          rest = { error: e, payError: e, ...rest }
        }
      }
    } else {
      // fee credits paid for it
      ourOnCompleted?.(data)
      onPaid?.(client.cache, { data })
    }

    setInnerResult({ data, ...rest })
    return { data, ...rest }
  }, [mutate, options, waitForPayment, onCompleted, client.cache])

  return [innerMutate, innerResult]
}

// all paid actions need these fields and they're easy to forget
function addOptimisticResponseExtras (optimisticResponse) {
  if (!optimisticResponse) return optimisticResponse
  const key = Object.keys(optimisticResponse)[0]
  optimisticResponse[key] = { invoice: null, paymentMethod: 'OPTIMISTIC', ...optimisticResponse[key] }
  return optimisticResponse
}