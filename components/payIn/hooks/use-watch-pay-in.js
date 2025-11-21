import { useQuery } from '@apollo/client'
import { GET_PAY_IN_RESULT } from '@/fragments/payIn'
import usePayInHelper, { WaitCheckControllerAbortedError } from './use-pay-in-helper'
import { useEffect, useMemo } from 'react'
import { FAST_POLL_INTERVAL_MS, SSR } from '@/lib/constants'

export default function useWatchPayIn ({ id, query = GET_PAY_IN_RESULT, onPaymentError, onPaymentSuccess, waitFor }) {
  const payInHelper = usePayInHelper()
  const queryOptions = useMemo(() => {
    if (SSR) {
      return { variables: { id }, fetchPolicy: 'cache-first' }
    }
    return {
      variables: { id },
      pollInterval: FAST_POLL_INTERVAL_MS,
      fetchPolicy: 'network-only',
      nextFetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: true
    }
  }, [id])
  const queryResult = useQuery(query, queryOptions)
  const { refetch } = queryResult

  // we use the controller in a useEffect like this so we can reuse the same logic
  // ... this controller is used in loops elsewhere where hooks are not allowed
  useEffect(() => {
    const controller = payInHelper.waitCheckController(id)

    const check = async () => {
      try {
        const payIn = await controller.wait(waitFor, { query })
        await refetch().catch(() => {})
        onPaymentSuccess?.(payIn)
      } catch (error) {
        // check for error type so that we don't callback when the controller is stopped
        // on unmount
        if (!(error instanceof WaitCheckControllerAbortedError)) {
          onPaymentError?.(error)
        }
      }
    }
    check()

    return () => controller.stop()
  }, [id, waitFor, payInHelper, onPaymentError, onPaymentSuccess, query, refetch])

  // this will return the payIn in the cache as the useEffect updates the cache
  return queryResult
}
