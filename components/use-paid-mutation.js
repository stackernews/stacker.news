import { useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import { useCallback, useState } from 'react'
import { InvoiceCanceledError, InvoiceExpiredError, useInvoice, useQrPayment, useWalletPayment } from './payment'
import { GET_PAID_ACTION, RETRY_PAID_ACTION } from '@/fragments/paidAction'

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
  const [retryPaidAction] = useMutation(RETRY_PAID_ACTION)

  const waitForWalletPayment = useWalletPayment()
  const invoiceHelper = useInvoice()
  const waitForQrPayment = useQrPayment()
  const client = useApolloClient()
  // innerResult is used to store/control the result of the mutation when innerMutate runs
  const [innerResult, setInnerResult] = useState(result)

  const waitForPayment = useCallback(async (invoice, { alwaysShowQROnFailure = false, persistOnNavigate = false, waitFor }, onMutationResponseUpdate) => {
    const walletErrors = []
    const paymentErrors = []

    let canRetry = true
    let updatedMutationResponse = null
    let updatedMutationRest = null

    /**
     * Get a new invoice from the server
     * @param {*} retryInvoice
     * @param {boolean} withFeeCredit - try to pay with CC if possible
     */
    const retry = async (retryInvoice, withFeeCredit) => {
      try {
        console.log('Retrying payment with fee credit:', withFeeCredit)
        const { data: retryData, ...retryRest } = await retryPaidAction({ variables: { invoiceId: Number(retryInvoice.id), forceFeeCredits: withFeeCredit } })
        const mutationResponse = retryData ? Object.values(retryData)[0] : null
        const mutationRest = retryRest
        const invoice = mutationResponse?.invoice
        const canRetry = mutationResponse?.canRetry
        return { invoice, canRetry, mutationResponse, mutationRest }
      } catch (e) {
        console.error(e)
        throw new Error('Failed to retry payment', e)
      }
    }

    let success = false

    // Try p2p payment
    while (!success) {
      try {
        if (!invoice) {
          console.warn('usePaidMutation: invoice is undefined, this is unexpected')
          break
        }
        await waitForWalletPayment(invoice, waitFor)
        success = true
      } catch (err) {
        const isWalletError = !(err instanceof InvoiceCanceledError || err instanceof InvoiceExpiredError)

        if (isWalletError) walletErrors.push(err)
        else paymentErrors.push(err)

        // cancel the invoice so it can be retried
        await invoiceHelper.cancel(invoice)

        if (canRetry) {
          // not the last receiver, so we try the next one
          const retryResult = await retry(invoice, false)
          invoice = retryResult.invoice
          canRetry = retryResult.canRetry
          updatedMutationResponse = retryResult.mutationResponse
          updatedMutationRest = retryResult.mutationRest
        } else {
          break
        }
      }
    }

    // Try CC payment
    if (!success) {
      // still no success after all receivers have been tried
      // so we fallback to CC wallet
      const retryResult = await retry(invoice, true)
      invoice = retryResult.invoice
      canRetry = retryResult.canRetry
      updatedMutationResponse = retryResult.mutationResponse
      updatedMutationRest = retryResult.mutationRest
      // if an invoice is returned, it means the CC payment failed
      success = !invoice
    }

    // Last resort: QR code payment if enabled
    if (!success) {
      if (!alwaysShowQROnFailure) {
        await invoiceHelper.cancel(invoice)
      } else {
        // show the qr code payment modal with last wallet error
        await waitForQrPayment(invoice, walletErrors[walletErrors.length - 1], { persistOnNavigate, waitFor })
        success = true
      }
    }

    // Results
    if (success) {
      if (updatedMutationResponse && onMutationResponseUpdate) {
        // sometimes we need to rerun the action to retry it on the server
        // so we ensures that the response is passed back in case it changes
        onMutationResponseUpdate(updatedMutationResponse, updatedMutationRest)
      }
      // just print the errors as warnings
      if (walletErrors.length > 0) {
        console.warn('usePaidMutation: successfully paid invoice but some wallet errors occurred', walletErrors)
      }
      if (paymentErrors.length > 0) {
        console.warn('usePaidMutation: successfully paid invoice but some payment errors occurred', paymentErrors)
      }
    } else {
      // everything failed, we throw an error
      console.error('usePaidMutation: failed to pay invoice', walletErrors, paymentErrors)
      throw new Error('Failed to pay invoice ', paymentErrors.map(e => e.message).join(', '), walletErrors.map(e => e.message).join(', '))
    }
  }, [waitForWalletPayment, waitForQrPayment, invoiceHelper])

  const innerMutate = useCallback(async ({
    onCompleted: innerOnCompleted, ...innerOptions
  } = {}) => {
    innerOptions.optimisticResponse = addOptimisticResponseExtras(innerOptions.optimisticResponse)
    let { data, ...rest } = await mutate(innerOptions)

    // use the most inner callbacks/options if they exist
    const {
      onPaid, onPayError, forceWaitForPayment, persistOnNavigate,
      update, waitFor = inv => inv?.actionState === 'PAID'
    } = { ...options, ...innerOptions }
    const ourOnCompleted = innerOnCompleted || onCompleted

    // get invoice without knowing the mutation name
    if (Object.values(data).length !== 1) {
      throw new Error('usePaidMutation: exactly one mutation at a time is supported')
    }

    let response = Object.values(data)[0]

    // if the mutation returns an invoice, pay it
    if (response?.invoice) {
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
        waitForPayment(response.invoice, { persistOnNavigate, waitFor }).then(() => {
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
          await waitForPayment(response.invoice, { alwaysShowQROnFailure: true, persistOnNavigate, waitFor }, (newMutationResponse, newMutationRest) => {
            const k = Object.keys(data)[0]
            data[k] = newMutationResponse
            rest = newMutationRest
            response = data[k]
          })
          if (!response.result) {
            // if the mutation didn't return any data, ie pessimistic, we need to fetch it
            const { data: { paidAction } } = await getPaidAction({ variables: { invoiceId: parseInt(response.invoice.id) } })
            // create new data object
            // ( hmac is only returned on invoice creation so we need to add it back to the data )
            data = {
              [Object.keys(data)[0]]: {
                ...paidAction,
                invoice: { ...paidAction.invoice, hmac: response.invoice.hmac }
              }
            }
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
        confirmedAt: () => new Date().toISOString(),
        satsReceived: () => invoice.satsRequested
      }
    })
  }
}
