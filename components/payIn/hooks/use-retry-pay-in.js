import { RETRY_PAY_IN } from '@/fragments/payIn'
import usePayInMutation from './use-pay-in-mutation'
import { useAct } from '@/components/item-act'
import { payBountyCacheMods } from '@/components/pay-bounty'

export function useRetryPayIn (payInId, mutationOptions = {}) {
  const [retryPayIn] = usePayInMutation(RETRY_PAY_IN, { ...mutationOptions, variables: { payInId } })
  return retryPayIn
}

export function useRetryItemActPayIn (payInId, mutationOptions = {}) {
  const retryPayIn = useAct({ query: RETRY_PAY_IN, ...mutationOptions, variables: { payInId } })
  return retryPayIn
}

export function useRetryBountyPayIn (payInId, mutationOptions = {}) {
  const options = {
    ...mutationOptions,
    ...payBountyCacheMods,
    update: (cache, { data }) => {
      payBountyCacheMods.update?.(cache, { data })
      mutationOptions.update?.(cache, { data })
    },
    onPayError: (error, cache, { data }) => {
      payBountyCacheMods.onPayError?.(error, cache, { data })
      mutationOptions.onPayError?.(error, cache, { data })
    },
    onPaid: (cache, { data }) => {
      payBountyCacheMods.onPaid?.(cache, { data })
      mutationOptions.onPaid?.(cache, { data })
    }
  }
  const retryPayIn = useAct({ query: RETRY_PAY_IN, ...options, variables: { payInId } })
  return retryPayIn
}
