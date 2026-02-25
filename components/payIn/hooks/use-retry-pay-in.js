import { RETRY_PAY_IN } from '@/fragments/payIn'
import usePayInMutation from './use-pay-in-mutation'
import { getActCachePhases } from '@/components/item-act'
import { payBountyCachePhases } from '@/components/pay-bounty'
import { useMe } from '@/components/me'
import { useHasSendWallet } from '@/wallets/client/hooks'
import { InvoiceCanceledError } from '@/wallets/client/errors'

export function useRetryPayIn (payInId, mutationOptions = {}) {
  const { restOptions, cachePhases } = splitMutationOptions(mutationOptions)
  const [retryPayIn] = usePayInMutation(RETRY_PAY_IN, { ...restOptions, cachePhases, variables: { payInId } })
  return retryPayIn
}

const ACT_PAY_IN_TYPES = ['ZAP', 'DOWN_ZAP', 'BOOST']

export function useRetryPayInByType (payInId, payInType, mutationOptions = {}) {
  const { me } = useMe()
  const hasSendWallet = useHasSendWallet()
  const { restOptions, cachePhases: userCachePhases } = splitMutationOptions(mutationOptions)

  const isAct = ACT_PAY_IN_TYPES.includes(payInType)
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

function splitMutationOptions (mutationOptions = {}) {
  const { cachePhases = {}, ...restOptions } = mutationOptions
  return {
    restOptions,
    cachePhases
  }
}

function withBountyCachePhases (userCachePhases) {
  return {
    onMutationResult: composeCallbacks(payBountyCachePhases.onMutationResult, userCachePhases.onMutationResult),
    onPaidMissingResult: composeCallbacks(payBountyCachePhases.onPaidMissingResult, userCachePhases.onPaidMissingResult),
    onPaid: composeCallbacks(payBountyCachePhases.onPaid, userCachePhases.onPaid),
    onPayError: composeCallbacks(payBountyCachePhases.onPayError, userCachePhases.onPayError)
  }
}

function withActCachePhases (actCachePhases, userCachePhases) {
  return {
    onMutationResult: composeCallbacks(actCachePhases.onMutationResult, userCachePhases.onMutationResult),
    onPaidMissingResult: composeCallbacks(actCachePhases.onMutationResult, userCachePhases.onPaidMissingResult),
    onPaid: composeCallbacks(actCachePhases.onPaid, userCachePhases.onPaid),
    onPayError: composeCallbacks(actCachePhases.onPayError, userCachePhases.onPayError)
  }
}

function composeCallbacks (...callbacks) {
  const validFns = callbacks.filter(Boolean)
  if (validFns.length === 0) return undefined

  return (...args) => {
    for (const fn of validFns) {
      fn(...args)
    }
  }
}
