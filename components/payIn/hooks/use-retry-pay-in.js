import { RETRY_PAY_IN } from '@/fragments/payIn'
import usePayInMutation from './use-pay-in-mutation'
import { getActCachePhases } from '@/components/item-act'
import { payBountyCachePhases } from '@/components/pay-bounty'
import { useMe } from '@/components/me'
import { useHasSendWallet } from '@/wallets/client/hooks'
import { InvoiceCanceledError } from '@/wallets/client/errors'
import { composeCallbacks } from '@/lib/compose-callbacks'
import { PAY_IN_ACT_TYPES } from '@/lib/constants'

export function useRetryPayIn (payInId, mutationOptions = {}) {
  const { restOptions, cachePhases } = splitMutationOptions(mutationOptions)
  const [retryPayIn] = usePayInMutation(RETRY_PAY_IN, { ...restOptions, cachePhases, variables: { payInId } })
  return retryPayIn
}

export function useRetryPayInByType (payInId, payInType, mutationOptions = {}) {
  const { me } = useMe()
  const hasSendWallet = useHasSendWallet()
  const { restOptions, cachePhases: userCachePhases } = splitMutationOptions(mutationOptions)

  const isAct = PAY_IN_ACT_TYPES.includes(payInType)
  const isBounty = payInType === 'BOUNTY_PAYMENT'
  const cachePhases = isBounty
    ? withBountyCachePhases(userCachePhases)
    : isAct
      ? withActCachePhases(getActCachePhases(me), userCachePhases)
      : userCachePhases

  const options = { ...restOptions, cachePhases }

  if (isAct) {
    options.waitFor = payIn =>
      hasSendWallet
        ? payIn?.payInState === 'PAID'
        : ['FORWARDING', 'PAID'].includes(payIn?.payInState)
  }

  const [retryPayIn] = usePayInMutation(RETRY_PAY_IN, { ...options, variables: { payInId } })
  return retryPayIn
}

export function getPayInFailureData (error) {
  return {
    payInState: 'FAILED',
    payInStateChangedAt: new Date().toISOString(),
    payerPrivates: {
      __typename: 'PayerPrivates',
      payInFailureReason: error instanceof InvoiceCanceledError ? 'USER_CANCELLED' : 'EXECUTION_FAILED'
    }
  }
}

export function getRetryPayInFailureUpdate (error, data) {
  const retryResult = Object.values(data ?? {})[0]
  if (!retryResult?.id) return null

  return {
    retryPayInId: retryResult.id,
    failureData: getPayInFailureData(error)
  }
}

function splitMutationOptions (mutationOptions = {}) {
  const { cachePhases = {}, ...restOptions } = mutationOptions
  return {
    restOptions,
    cachePhases
  }
}

function withBountyCachePhases (userCachePhases) {
  return withComposedCachePhases(payBountyCachePhases, userCachePhases, {
    onPaidMissingResult: payBountyCachePhases.onPaidMissingResult
  })
}

function withActCachePhases (actCachePhases, userCachePhases) {
  return withComposedCachePhases(actCachePhases, userCachePhases, {
    // Keep existing semantics: if paid payload has no result, reuse mutation-phase cache update.
    onPaidMissingResult: actCachePhases.onMutationResult
  })
}

function withComposedCachePhases (baseCachePhases, userCachePhases, { onPaidMissingResult } = {}) {
  return {
    onMutationResult: composeCallbacks(baseCachePhases.onMutationResult, userCachePhases.onMutationResult),
    onPaidMissingResult: composeCallbacks(onPaidMissingResult, userCachePhases.onPaidMissingResult),
    onPaid: composeCallbacks(baseCachePhases.onPaid, userCachePhases.onPaid),
    onPayError: composeCallbacks(baseCachePhases.onPayError, userCachePhases.onPayError)
  }
}
