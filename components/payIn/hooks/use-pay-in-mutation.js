// if PENDING_HELD and not a zap, then it's pessimistic
// if PENDING_HELD and a zap, it's optimistic unless the zapper is anon

import { useCallback, useMemo, useState } from 'react'
import { InvoiceCanceledError } from '@/wallets/client/errors'
import { useApolloClient, useMutation } from '@apollo/client/react'
import usePayPayIn from '@/components/payIn/hooks/use-pay-pay-in'
import { getOperationAST } from 'graphql'
import { useMe } from '@/components/me'
import { USER_ID } from '@/lib/constants'
import { isAutoRetryEligiblePayIn } from './use-auto-retry-pay-ins'
import { composeCallbacks } from '@/lib/compose-callbacks'
import { usePreferredSendProtocolId } from '@/wallets/client/hooks'

/*
this is just like useMutation with a few changes:
1. pays an invoice returned by the mutation
2. takes grouped cachePhases callbacks and additional options for payment behavior
  - namely forceWaitForPayment which will always wait for the invoice to be paid
  - and persistOnNavigate which will keep the invoice in the cache after navigation
3. onCompleted behaves a little differently, but analogously to useMutation, ie clientside side effects
  of completion can still rely on it. It's composed like other callbacks (hook-level + call-site both run).
  a. it's called before the invoice is paid for optimistic updates
  b. it's called after the invoice is paid for pessimistic updates
4. cachePhases.onMutationResult is mutation-phase only (Apollo update callback)
5. cachePhases.onPaidMissingResult runs only if the initial mutation response had no payerPrivates.result
6. cachePhases.onPaid always runs after payment confirmation
7. cachePhases.onPayError runs when payment fails
8. we return a payError field in the result object if the invoice fails to pay
*/
export default function usePayInMutation (mutation, { onCompleted, ...options } = {}) {
  const { me } = useMe()
  const sendProtocolId = usePreferredSendProtocolId()
  const [mutate, result] = useMutation(mutation)
  const client = useApolloClient()
  // innerResult is used to store/control the result of the mutation when innerMutate runs
  const [innerResult, setInnerResult] = useState(result)
  const payPayIn = usePayPayIn()
  const mutationName = getOperationAST(mutation)?.name?.value
  const hookOptions = useMemo(
    () => withPayInMutationDefaults(mutation, options, me, sendProtocolId),
    [mutation, options, me, sendProtocolId]
  )

  const innerMutate = useCallback(async ({ onCompleted: innerOnCompleted, ...innerOptions } = {}) => {
    const callOptions = withPayInMutationDefaults(mutation, innerOptions, me, sendProtocolId)

    const hookCachePhases = hookOptions.cachePhases || {}
    const callCachePhases = callOptions.cachePhases || {}
    const onMutationResult = composeCallbacks(hookCachePhases.onMutationResult, callCachePhases.onMutationResult)
    const onPayError = composeCallbacks(hookCachePhases.onPayError, callCachePhases.onPayError)
    const onPaidMissingResult = composeCallbacks(hookCachePhases.onPaidMissingResult, callCachePhases.onPaidMissingResult)
    const onPaid = composeCallbacks(hookCachePhases.onPaid, callCachePhases.onPaid)
    const onRetry = composeCallbacks(hookOptions.onRetry, callOptions.onRetry)
    const ourOnCompleted = composeCallbacks(onCompleted, innerOnCompleted)

    const mergedOptions = {
      ...hookOptions,
      ...callOptions
    }
    if (hookOptions.variables || callOptions.variables) {
      mergedOptions.variables = {
        ...(hookOptions.variables || {}),
        ...(callOptions.variables || {})
      }
    }
    const { data, ...rest } = await mutate({
      ...mergedOptions,
      update: composeCallbacks(mergedOptions.update, onMutationResult)
    })
    const {
      forceWaitForPayment, persistOnNavigate,
      waitFor = payIn => payIn?.payInState === 'PAID', protocolLimit
    } = mergedOptions

    const payIn = data[mutationName]
    const hadInitialResult = Boolean(payIn?.payerPrivates?.result)
    const fallbackResult = payIn?.payerPrivates?.result
    const emitPaidSuccess = ({ paidPayIn, includeOnCompleted = false }) => {
      const mergedPayIn = mergePayInWithFallbackResult(paidPayIn, fallbackResult)
      const paidData = { [mutationName]: mergedPayIn }
      if (includeOnCompleted) {
        ourOnCompleted?.(paidData)
      }
      if (!hadInitialResult) {
        onPaidMissingResult?.(client.cache, { data: paidData })
      }
      onPaid?.(client.cache, { data: paidData })
    }

    // if the mutation returns in a pending state, it has an invoice we need to pay
    let payError
    if (payIn.payInState === 'PENDING' || payIn.payInState === 'PENDING_HELD') {
      if (isClientPessimisticPayIn(payIn, me, forceWaitForPayment)) {
        // the action is pessimistic
        try {
          // wait for the invoice to be paid
          const paidPayIn = await payPayIn(payIn, { alwaysShowQROnFailure: true, persistOnNavigate, waitFor, onRetry, protocolLimit })
          emitPaidSuccess({ paidPayIn, includeOnCompleted: true })
        } catch (e) {
          console.error('usePayInMutation: failed to pay for pessimistic mutation', mutationName, e)
          onPayError?.(e, client.cache, { data })
          payError = e
        }
      } else {
        // onCompleted is called before the invoice is paid for optimistic updates
        ourOnCompleted?.(data)
        // don't wait to pay the invoice
        payPayIn(payIn, { persistOnNavigate, waitFor, onRetry, protocolLimit }).then((paidPayIn) => {
          // invoice might have been retried during payment
          emitPaidSuccess({ paidPayIn })
        }).catch(e => {
          console.error('usePayInMutation: failed to pay for optimistic mutation', mutationName, e)
          // onPayError is called after the invoice fails to pay, but only if we're not automatically retrying
          // because if we're automatically retrying, we want the optimistic cache to persist
          if (e instanceof InvoiceCanceledError || !isAutoRetryEligiblePayIn(payIn)) {
            onPayError?.(e, client.cache, { data })
          }
          payError = e
        })
      }
    } else if (payIn.payInState === 'PAID') {
      emitPaidSuccess({ paidPayIn: payIn, includeOnCompleted: true })
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
  }, [mutate, hookOptions, payPayIn, client.cache, mutation, mutationName, me, sendProtocolId, onCompleted])

  return [innerMutate, innerResult]
}

function isClientPessimisticPayIn (payIn, me, forceWaitForPayment) {
  return forceWaitForPayment ||
    !me ||
    (payIn.payInState === 'PENDING_HELD' && payIn.payInType !== 'ZAP' && payIn.payInType !== 'BOUNTY_PAYMENT')
}

function mergePayInWithFallbackResult (paidPayIn, fallbackResult) {
  // Some paid responses only return the PayIn state transition and not the original result
  // payload, so we preserve the initial result when needed for paid-phase cache updates.
  return !paidPayIn?.payerPrivates?.result && fallbackResult
    ? {
        ...paidPayIn,
        payerPrivates: {
          ...(paidPayIn?.payerPrivates || {}),
          result: fallbackResult
        }
      }
    : paidPayIn
}

function withPayInMutationDefaults (mutation, options = {}, me, sendProtocolId) {
  const nextOptions = {
    ...options,
    optimisticResponse: addOptimisticResponseExtras(mutation, options.optimisticResponse, me)
  }

  if (sendProtocolId !== undefined) {
    const variables = {
      ...(options.variables || {})
    }

    if (variables.sendProtocolId === undefined) {
      variables.sendProtocolId = sendProtocolId
    }

    nextOptions.variables = variables
  }

  return nextOptions
}

// all paid actions need these fields and they're easy to forget
function addOptimisticResponseExtras (mutation, payInOptimisticResponse, me) {
  if (!payInOptimisticResponse) return payInOptimisticResponse
  const mutationName = getOperationAST(mutation)?.name?.value
  const payerPrivates = payInOptimisticResponse.payerPrivates?.result
    ? {
        ...payInOptimisticResponse.payerPrivates,
        result: { ...payInOptimisticResponse.payerPrivates.result, payIn: null },
        payInBolt11: null,
        userId: me?.id ?? USER_ID.anon,
        payInFailureReason: null,
        payInCustodialTokens: [],
        pessimisticEnv: null,
        retryCount: 0
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
