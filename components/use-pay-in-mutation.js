// if PENDING_HELD and not a zap, then it's pessimistic
// if PENDING_HELD and a zap, it's optimistic unless the zapper is anon

import { useCallback, useState } from 'react'
import { InvoiceCanceledError } from '@/wallets/client/errors'
import { useApolloClient, useMutation } from '@apollo/client'
import { useWaitForPayIn } from './use-wait-for-pay-in'
import { getOperationName } from '@apollo/client/utilities'
import { useMe } from './me'

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
export function usePayInMutation (mutation, options) {
  if (options) {
    options.optimisticResponse = addOptimisticResponseExtras(mutation, options.optimisticResponse)
  }
  const [mutate, result] = useMutation(mutation, options)
  const client = useApolloClient()
  const { me } = useMe()
  // innerResult is used to store/control the result of the mutation when innerMutate runs
  const [innerResult, setInnerResult] = useState(result)
  const waitForPayIn = useWaitForPayIn()
  const mutationName = getOperationName(mutation)

  const innerMutate = useCallback(async (innerOptions) => {
    if (innerOptions) {
      innerOptions.optimisticResponse = addOptimisticResponseExtras(mutation, innerOptions.optimisticResponse)
    }
    const { data, ...rest } = await mutate({ ...options, ...innerOptions })

    // use the most inner callbacks/options if they exist
    const {
      onPaid, onPayError, forceWaitForPayment, persistOnNavigate,
      update, waitFor = inv => inv?.actionState === 'PAID', updateOnFallback,
      onCompleted
    } = { ...options, ...innerOptions }

    const payIn = data[mutationName]

    // if the mutation returns in a pending state, it has an invoice we need to pay
    let payError
    if (payIn.payInState === 'PENDING' || payIn.payInState === 'PENDING_HELD') {
      if (forceWaitForPayment || !me || (payIn.payInState === 'PENDING_HELD' && payIn.payInType !== 'ZAP')) {
        // the action is pessimistic
        try {
          // wait for the invoice to be paid
          const paidPayIn = await waitForPayIn(payIn, { alwaysShowQROnFailure: true, persistOnNavigate, waitFor, updateOnFallback })

          // we need to run update functions on mutations now that we have the data
          const data = { [mutationName]: paidPayIn }
          update?.(client.cache, { data })
          onCompleted?.(data)
          onPaid?.(client.cache, { data })
        } catch (e) {
          console.error('usePaidMutation: failed to pay for pessimistic mutation', mutationName, e)
          onPayError?.(e, client.cache, { data })
          payError = e
        }
      } else {
        // onCompleted is called before the invoice is paid for optimistic updates
        onCompleted?.(data)
        // don't wait to pay the invoice
        waitForPayIn(payIn, { persistOnNavigate, waitFor, updateOnFallback }).then((paidPayIn) => {
          // invoice might have been retried during payment
          onPaid?.(client.cache, { data: { [mutationName]: paidPayIn } })
        }).catch(e => {
          console.error('usePaidMutation: failed to pay for optimistic mutation', mutationName, e)
          // onPayError is called after the invoice fails to pay
          // useful for updating invoiceActionState to FAILED
          onPayError?.(e, client.cache, { data })
          payError = e
        })
      }
    } else if (payIn.payInState === 'PAID') {
      // fee credits/reward sats paid for it
      onCompleted?.(data)
      onPaid?.(client.cache, { data })
    } else {
      payError = new Error(`PayIn is in an unexpected state: ${payIn.payInState}`)
    }

    const result = {
      data,
      payError,
      ...rest,
      error: payError instanceof InvoiceCanceledError && payError.actionError ? payError : undefined
    }
    setInnerResult(result)
    return result
  }, [mutate, options, waitForPayIn, client.cache, setInnerResult, !!me])

  return [innerMutate, innerResult]
}

// all paid actions need these fields and they're easy to forget
function addOptimisticResponseExtras (mutation, optimisticResponse) {
  if (!optimisticResponse) return optimisticResponse
  const mutationName = getOperationName(mutation)
  optimisticResponse[mutationName] = {
    __typename: 'PayIn',
    payInBolt11: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    payInState: 'PENDING',
    payInStateChangedAt: new Date().toISOString(),
    payInType: null,
    payInFailureReason: null,
    payInCustodialTokens: null,
    mcost: null,
    result: optimisticResponse[mutationName]
  }
  return optimisticResponse
}
