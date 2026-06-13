import { RETRY_PAY_IN } from '@/fragments/payIn'
import usePayInMutation from './use-pay-in-mutation'
import { getActCachePhases } from '@/components/item-act'
import { payBountyCachePhases } from '@/components/pay-bounty'
import { useMe } from '@/components/me'
import { useHasSendWallet } from '@/wallets/client/hooks'
import { InvoiceCanceledError } from '@/wallets/client/errors'
import { composeCallbacks } from '@/lib/compose-callbacks'
import { PAY_IN_ACT_TYPES } from '@/lib/constants'
import { E_PAY_IN_RETRY_RACE } from '@/lib/error'
import { toFailedPayIn } from '@/lib/pay-in'

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

// the FAILED view of a retry mutation's successor for cache writes when paying it failed
export function getFailedRetryPayIn (error, data) {
  const retryResult = Object.values(data ?? {})[0]
  if (!retryResult?.id) return null

  return toFailedPayIn(retryResult, error instanceof InvoiceCanceledError ? 'USER_CANCELLED' : 'EXECUTION_FAILED')
}

// retry() (api/payIn/index.js) rejects with an E_PAY_IN_RETRY_RACE-coded error when the lineage
// already advanced, the successor isn't FAILED yet, or a concurrent retry won the successorId
// lock. These races are expected under rapid clicks / multiple tabs and are swallowed by the
// background auto-retry too — so a manual retry shouldn't surface them as an error.
export function isBenignRetryRaceError (error) {
  return [error, ...(error?.errors ?? [])].some(e => e?.extensions?.code === E_PAY_IN_RETRY_RACE)
}

function splitMutationOptions (mutationOptions = {}) {
  const { cachePhases = {}, ...restOptions } = mutationOptions
  return {
    restOptions,
    cachePhases
  }
}

function withBountyCachePhases (userCachePhases) {
  return withComposedCachePhases(payBountyCachePhases, userCachePhases)
}

// the genesis act already bumped the item counters optimistically and that bump persists through
// the lineage, so a retry must NOT re-apply it (there's no reconcile to undo a double-add). it
// keeps only the act's onPayError (reverse the bump on terminal failure — usePayInMutation gates
// this to non-retryable failures) and onPaid (bump ancestors on success); the caller's own phases
// (e.g. the notification's payIn-state writes) compose as usual.
function withActCachePhases (actCachePhases, userCachePhases) {
  return {
    onMutationResult: userCachePhases.onMutationResult,
    onPaidMissingResult: userCachePhases.onPaidMissingResult,
    onPaid: composeCallbacks(actCachePhases.onPaid, userCachePhases.onPaid),
    onPayError: composeCallbacks(actCachePhases.onPayError, userCachePhases.onPayError)
  }
}

function withComposedCachePhases (baseCachePhases, userCachePhases, { onPaidMissingResult } = {}) {
  return {
    onMutationResult: composeCallbacks(baseCachePhases.onMutationResult, userCachePhases.onMutationResult),
    onPaidMissingResult: composeCallbacks(onPaidMissingResult, userCachePhases.onPaidMissingResult),
    onPaid: composeCallbacks(baseCachePhases.onPaid, userCachePhases.onPaid),
    onPayError: composeCallbacks(baseCachePhases.onPayError, userCachePhases.onPayError)
  }
}
