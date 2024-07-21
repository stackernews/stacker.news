import { useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import { useCallback, useState } from 'react'
import { InvoiceCanceledError, InvoiceExpiredError, useQrPayment, useWalletPayment } from './payment'
import { GET_PAID_ACTION } from '@/fragments/paidAction'

/*
this is just like useMutation with a few changes:
1. pays an invoice returned by the mutation
2. takes an onPaid and onPayError callback, and additional options for payment behavior
  - namely forceWaitForPayment which will always wait for the invoice to be paid
  - and persistOnNavigate which will keep the invoice in the cache after navigation
3. onCompleted behaves a little differently, but analogously to useMutation, ie clientside side effects
  of completion can still rely on it
  a. it's called before the invoice is paid for optimistic updates
  b. it's called after the invoice is paid for pessimistic updates
4. we return a payError field in the result object if the invoice fails to pay
*/
export function usePaidMutation (mutation,
  { onCompleted, ...options } = {}) {
  options.optimisticResponse = addOptimisticResponseExtras(options.optimisticResponse)
  const [mutate, result] = useMutation(mutation, options)
  const [getPaidAction] = useLazyQuery(GET_PAID_ACTION, {
    fetchPolicy: 'network-only'
  })
  const waitForWalletPayment = useWalletPayment()
  const waitForQrPayment = useQrPayment()
  const client = useApolloClient()
  // innerResult is used to store/control the result of the mutation when innerMutate runs
  const [innerResult, setInnerResult] = useState(result)

  const waitForPayment = useCallback(async (invoice, { alwaysShowQROnFailure = false, persistOnNavigate = false, waitFor }) => {
    let walletError
    const start = Date.now()
    try {
      return await waitForWalletPayment(invoice, waitFor)
    } catch (err) {
      if (
        (!alwaysShowQROnFailure && Date.now() - start > 1000) ||
        err instanceof InvoiceCanceledError ||
        err instanceof InvoiceExpiredError) {
        // bail since qr code payment will also fail
        // also bail if the payment took more than 1 second
        throw err
      }
      walletError = err
    }
    return await waitForQrPayment(invoice, walletError, { persistOnNavigate, waitFor })
  }, [waitForWalletPayment, waitForQrPayment])

  const innerMutate = useCallback(async ({
    onCompleted: innerOnCompleted, ...innerOptions
  } = {}) => {
    innerOptions.optimisticResponse = addOptimisticResponseExtras(innerOptions.optimisticResponse)
    let { data, ...rest } = await mutate(innerOptions)

    // use the most inner callbacks/options if they exist
    const { onPaid, onPayError, forceWaitForPayment, persistOnNavigate, update } = { ...options, ...innerOptions }
    const ourOnCompleted = innerOnCompleted || onCompleted

    // get invoice without knowing the mutation name
    if (Object.values(data).length !== 1) {
      throw new Error('usePaidMutation: exactly one mutation at a time is supported')
    }
    const response = Object.values(data)[0]
    const invoice = response?.invoice

    // if the mutation returns an invoice, pay it
    if (invoice) {
      // adds payError, escalating to a normal error if the invoice is not canceled or
      // has an actionError
      const addPayError = (e, rest) => ({
        ...rest,
        payError: e,
        error: e instanceof InvoiceCanceledError && e.actionError ? e : undefined
      })

      // should we wait for the invoice to be paid?
      if (response?.paymentMethod === 'OPTIMISTIC' && !forceWaitForPayment) {
        // onCompleted is called before the invoice is paid for optimistic updates
        ourOnCompleted?.(data)
        // don't wait to pay the invoice
        waitForPayment(invoice, { persistOnNavigate }).then(() => {
          onPaid?.(client.cache, { data })
        }).catch(e => {
          console.error('usePaidMutation: failed to pay invoice', e)
          // onPayError is called after the invoice fails to pay
          // useful for updating invoiceActionState to FAILED
          onPayError?.(e, client.cache, { data })
          setInnerResult(r => addPayError(e, r))
        })
      } else {
        // the action is pessimistic
        try {
          // wait for the invoice to be paid
          await waitForPayment(invoice, { alwaysShowQROnFailure: true, persistOnNavigate, waitFor: inv => inv?.actionState === 'PAID' })
          if (!response.result) {
            // if the mutation didn't return any data, ie pessimistic, we need to fetch it
            const { data: { paidAction } } = await getPaidAction({ variables: { invoiceId: parseInt(invoice.id) } })
            // create new data object
            data = { [Object.keys(data)[0]]: paidAction }
            // we need to run update functions on mutations now that we have the data
            update?.(client.cache, { data })
          }
          ourOnCompleted?.(data)
          onPaid?.(client.cache, { data })
        } catch (e) {
          console.error('usePaidMutation: failed to pay invoice', e)
          onPayError?.(e, client.cache, { data })
          rest = addPayError(e, rest)
        }
      }
    } else {
      // fee credits paid for it
      ourOnCompleted?.(data)
      onPaid?.(client.cache, { data })
    }

    setInnerResult({ data, ...rest })
    return { data, ...rest }
  }, [mutate, options, waitForPayment, onCompleted, client.cache, getPaidAction, setInnerResult])

  return [innerMutate, innerResult]
}

// all paid actions need these fields and they're easy to forget
function addOptimisticResponseExtras (optimisticResponse) {
  if (!optimisticResponse) return optimisticResponse
  const key = Object.keys(optimisticResponse)[0]
  optimisticResponse[key] = { invoice: null, paymentMethod: 'OPTIMISTIC', ...optimisticResponse[key] }
  return optimisticResponse
}

// most paid actions have the same cache modifications
// these let us preemptively update the cache before a query updates it
export const paidActionCacheMods = {
  update: (cache, { data }) => {
    const response = Object.values(data)[0]
    if (!response?.invoice) return
    const { invoice } = response

    cache.modify({
      id: `Invoice:${invoice.id}`,
      fields: {
        actionState: () => 'PENDING'
      }
    })
  },
  onPayError: (e, cache, { data }) => {
    const response = Object.values(data)[0]
    if (!response?.invoice) return
    const { invoice } = response

    cache.modify({
      id: `Invoice:${invoice.id}`,
      fields: {
        actionState: () => 'FAILED'
      }
    })
  },
  onPaid: (cache, { data }) => {
    const response = Object.values(data)[0]
    if (!response?.invoice) return
    const { invoice } = response

    cache.modify({
      id: `Invoice:${invoice.id}`,
      fields: {
        actionState: () => 'PAID',
        confirmedAt: () => new Date().toISOString()
      }
    })
  }
}
