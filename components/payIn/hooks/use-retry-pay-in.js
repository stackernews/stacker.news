import { RETRY_PAY_IN } from '@/fragments/payIn'
import usePayInMutation from './use-pay-in-mutation'
import { getActCachePhases } from '@/components/item-act'
import { payBountyCachePhases } from '@/components/pay-bounty'
import { useMe } from '@/components/me'
import { useHasSendWallet } from '@/wallets/client/hooks'
import { InvoiceCanceledError, isTransientNetworkError } from '@/wallets/client/errors'
import { composeCallbacks } from '@/lib/compose-callbacks'
import { PAY_IN_ACT_TYPES } from '@/lib/constants'
import { E_PAY_IN_RETRY_RACE } from '@/lib/error'
import { actWaitFor, getPayIn, toFailedPayIn } from '@/lib/pay-in'

export function useRetryPayIn (payInId, payInType, mutationOptions = {}) {
  const { me } = useMe()
  const hasSendWallet = useHasSendWallet()
  const { cachePhases: userCachePhases = {}, ...restOptions } = mutationOptions

  const isAct = PAY_IN_ACT_TYPES.includes(payInType)
  const cachePhases = composeRetryCachePhases(retryBaseCachePhases(payInType, me), userCachePhases)

  // a manual retry's fresh invoice creation/wrap failure is terminal — debump and show FAILED. (a
  // genesis failure instead keeps its optimistic bump and auto-retries in the background.)
  const options = { ...restOptions, cachePhases, failOnInvoiceSetupPending: true }

  if (isAct) {
    options.waitFor = actWaitFor(hasSendWallet)
  }

  const [retryPayIn] = usePayInMutation(RETRY_PAY_IN, { ...options, variables: { payInId } })
  return retryPayIn
}

// the FAILED view of a retry mutation's successor for cache writes when paying it failed
export function getFailedRetryPayIn (error, data) {
  const retryResult = getPayIn(data)
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

// the shared manual-retry click handler for the notifications and item-info retry buttons: disable
// the button, run the retry, surface non-benign errors, re-enable. `retry` returns { error } or
// throws; a benign retry race (lineage advanced / concurrent retry) is expected and not surfaced.
export async function runManualRetry (retry, { setDisable, toaster }) {
  setDisable(true)
  try {
    const { error } = await retry()
    if (error) throw error
  } catch (error) {
    // benign retry races and gateway timeouts (the retry is still being processed) aren't surfaced
    if (!isBenignRetryRaceError(error) && !isTransientNetworkError(error)) {
      toaster.danger(error?.message || error?.toString?.())
    }
  } finally {
    setDisable(false)
  }
}

// the per-type cache phases for a retry, composed on top of the caller's phases (e.g. the
// notification's payIn-state writes).
// - acts: identical to the genesis act phases. the retry button bumps the item at click time
//   (notifications.js, same as the modal/bolt), so these only reconcile credits (onMutationResult),
//   reverse on terminal failure (onPayError, gated by usePayInMutation to non-retryable failures),
//   and bump ancestors on success (onPaid). the notifications reconcile link had already removed
//   the failed lineage's bump, so the click-time re-bump is exact.
// - bounty: re-running the full phases is harmless — onMutationResult appends to a set, onPayError
//   filters it.
// - everything else contributes no base phases.
function retryBaseCachePhases (payInType, me) {
  if (PAY_IN_ACT_TYPES.includes(payInType)) {
    return getActCachePhases(me)
  }
  if (payInType === 'BOUNTY_PAYMENT') return payBountyCachePhases
  return {}
}

function composeRetryCachePhases (baseCachePhases, userCachePhases) {
  // compose all four phases uniformly so a caller's onPaidMissingResult isn't silently dropped
  // (act/bounty retries don't currently supply one, but a future ITEM_CREATE retry might)
  return {
    onMutationResult: composeCallbacks(baseCachePhases.onMutationResult, userCachePhases.onMutationResult),
    onPaidMissingResult: composeCallbacks(baseCachePhases.onPaidMissingResult, userCachePhases.onPaidMissingResult),
    onPaid: composeCallbacks(baseCachePhases.onPaid, userCachePhases.onPaid),
    onPayError: composeCallbacks(baseCachePhases.onPayError, userCachePhases.onPayError)
  }
}
