// if PENDING_HELD and not a zap, then it's pessimistic
// if PENDING_HELD and a zap, it's optimistic unless the zapper is anon

import { useCallback, useState } from 'react'
import { InvoiceCanceledError } from '@/wallets/client/errors'
import { useApolloClient, useMutation } from '@apollo/client'
import usePayPayIn from '@/components/payIn/hooks/use-pay-pay-in'
import { getOperationName } from '@apollo/client/utilities'
import { useMe } from '@/components/me'
import { USER_ID } from '@/lib/constants'

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
export default function usePayInMutation (mutation, { onCompleted, ...options } = {}) {
  const { me } = useMe()

  if (options) {
    options.optimisticResponse = addOptimisticResponseExtras(mutation, options.optimisticResponse, me)
  }
  const [mutate, result] = useMutation(mutation, options)
  const client = useApolloClient()
  // innerResult is used to store/control the result of the mutation when innerMutate runs
  const [innerResult, setInnerResult] = useState(result)
  const payPayIn = usePayPayIn()
  const mutationName = getOperationName(mutation)

  const innerMutate = useCallback(async ({ onCompleted: innerOnCompleted, ...innerOptions } = {}) => {
    if (innerOptions) {
      innerOptions.optimisticResponse = addOptimisticResponseExtras(mutation, innerOptions.optimisticResponse, me)
    }
    const { data, ...rest } = await mutate({ ...options, ...innerOptions })

    // use the most inner callbacks/options if they exist
    const {
      onPaid, onPayError, forceWaitForPayment, persistOnNavigate,
      update, waitFor = payIn => payIn?.payInState === 'PAID'
    } = { ...options, ...innerOptions }
    // onCompleted needs to run after the payIn is paid for pessimistic updates, so we give it special treatment
    const ourOnCompleted = innerOnCompleted || onCompleted

    const payIn = data[mutationName]

    console.log('payInMutation', payIn)

    // if the mutation returns in a pending state, it has an invoice we need to pay
    let payError
    if (payIn.payInState === 'PENDING' || payIn.payInState === 'PENDING_HELD') {
      console.log('payInMutation: pending', payIn.payInState, payIn.payInType)
      if (forceWaitForPayment || !me || (payIn.payInState === 'PENDING_HELD' && payIn.payInType !== 'ZAP')) {
        console.log('payInMutation: forceWaitForPayment', forceWaitForPayment, me, payIn.payInState, payIn.payInType)
        // the action is pessimistic
        try {
          // wait for the invoice to be paid
          const paidPayIn = await payPayIn(payIn, { alwaysShowQROnFailure: true, persistOnNavigate, waitFor, updateOnFallback: update })
          console.log('payInMutation: paidPayIn', paidPayIn)
          // we need to run update functions on mutations now that we have the data
          const data = { [mutationName]: paidPayIn }
          update?.(client.cache, { data })
          ourOnCompleted?.(data)
          onPaid?.(client.cache, { data })
        } catch (e) {
          console.error('usePayInMutation: failed to pay for pessimistic mutation', mutationName, e)
          onPayError?.(e, client.cache, { data })
          payError = e
        }
      } else {
        console.log('payInMutation: not forceWaitForPayment', forceWaitForPayment, me, payIn.payInState, payIn.payInType)
        // onCompleted is called before the invoice is paid for optimistic updates
        ourOnCompleted?.(data)
        // don't wait to pay the invoice
        payPayIn(payIn, { persistOnNavigate, waitFor, updateOnFallback: update }).then((paidPayIn) => {
          // invoice might have been retried during payment
          onPaid?.(client.cache, { data: { [mutationName]: paidPayIn } })
        }).catch(e => {
          console.error('usePayInMutation: failed to pay for optimistic mutation', mutationName, e)
          // onPayError is called after the invoice fails to pay
          onPayError?.(e, client.cache, { data })
          payError = e
        })
      }
    } else if (payIn.payInState === 'PAID') {
      console.log('payInMutation: paid', payIn.payInState, payIn.payInType)
      // fee credits/reward sats paid for it
      ourOnCompleted?.(data)
      onPaid?.(client.cache, { data })
    } else {
      console.log('payInMutation: unexpected', payIn.payInState, payIn.payInType)
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
  }, [mutate, options, payPayIn, client.cache, setInnerResult, !!me])

  return [innerMutate, innerResult]
}

// all paid actions need these fields and they're easy to forget
function addOptimisticResponseExtras (mutation, payInOptimisticResponse, me) {
  if (!payInOptimisticResponse) return payInOptimisticResponse
  const mutationName = getOperationName(mutation)
  const payerPrivates = payInOptimisticResponse.payerPrivates?.result
    ? {
        ...payInOptimisticResponse.payerPrivates,
        result: { ...payInOptimisticResponse.payerPrivates.result, payIn: null },
        payInBolt11: null,
        userId: me?.id ?? USER_ID.anon,
        payInFailureReason: null,
        payInCustodialTokens: [],
        pessimisticEnv: null
      }
    : payInOptimisticResponse.payerPrivates
  return {
    [mutationName]: {
      __typename: 'PayIn',
      id: 'temp-pay-in-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payInState: 'PENDING',
      payInStateChangedAt: new Date().toISOString(),
      payInType: payInOptimisticResponse.payInType,
      payOutBolt11Public: null,
      payerPrivates,
      mcost: payInOptimisticResponse.mcost
    }
  }
}
