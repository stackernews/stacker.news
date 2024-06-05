import { useMutation } from '@apollo/client'
import { useCallback } from 'react'
import { InvoiceCanceledError, InvoiceExpiredError, useQrPayment, useWebLnPayment } from './payment'
import { useMe } from './me'

// this is just like useMutation but it pays an invoice returned by the mutation
export function usePaidMutation (mutation, { onPaid, ...options }) {
  const [mutate, result] = useMutation(mutation, options)
  const waitForWebLnPayment = useWebLnPayment()
  const waitForQrPayment = useQrPayment()
  const me = useMe()

  const waitForPayment = useCallback(async invoice => {
    let webLnError
    try {
      return await waitForWebLnPayment(invoice)
    } catch (err) {
      if (err instanceof InvoiceCanceledError || err instanceof InvoiceExpiredError) {
        // bail since qr code payment will also fail
        throw err
      }
      webLnError = err
    }
    return await waitForQrPayment(invoice, webLnError)
  }, [waitForWebLnPayment, waitForQrPayment])

  const innerMutate = useCallback(async innerOptions => {
    if (!me) {
      // if the user is not logged in, don't use optimistic updates
      // this allows us to be optimisitic for logged in users and
      // pessimistic for logged out users ... overrides outer options
      innerOptions.optimisticResponse = null
    }

    const { data, ...rest } = await mutate(innerOptions)

    // get invoice without knowing the mutation name
    if (Object.values(data).length !== 1) {
      throw new Error('usePaidMutation: exactly one mutation at a time is supported')
    }
    const result = Object.values(data)[0]
    const invoice = result?.invoice

    // if the mutation returns an invoice, pay it
    if (invoice) {
      // pay the invoice in a promise
      const pay = async () => {
        await waitForPayment(invoice)
        if (invoice.hmac) {
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
        onPaid?.(rest.client.cache, data)
      }

      // if the mutation returns more than just the invoice, it's serverside optimistic
      const ssOptimistic = result && Object.keys(result).length > 1

      // if this is an optimistic update, don't wait to pay the invoice
      if (me && (innerOptions.optimisticResponse || options.optimisticResponse || ssOptimistic)) {
        pay().catch(console.error)
      } else {
        // otherwise, wait for to pay before completing the mutation
        return await pay()
      }
    }
    return { data, ...rest }
  }, [!!me, mutate, waitForPayment, onPaid, options.variables, options.optimisticResponse])

  return [innerMutate, result]
}
