import { useQuery } from '@apollo/client'
import { GET_PAY_IN_RESULT } from '@/fragments/payIn'
import usePayInHelper, { WaitCheckControllerAbortedError } from './use-pay-in-helper'
import { useEffect } from 'react'

export default function useWatchPayIn ({ id, query = GET_PAY_IN_RESULT, onPaymentError, onPaymentSuccess, waitFor }) {
  const payInHelper = usePayInHelper()

  // we use the controller in a useEffect like this so we can reuse the same logic
  // ... this controller is used in loops elsewhere where hooks are not allowed
  useEffect(() => {
    const controller = payInHelper.waitCheckController(id, waitFor, { query, fetchPolicy: 'cache-and-network' })

    console.log('useWatchPayIn: useEffect', id)
    const check = async () => {
      console.log('useWatchPayIn: check', id)
      try {
        const payIn = await controller.wait()
        console.log('useWatchPayIn: check: success', payIn)
        onPaymentSuccess?.(payIn)
      } catch (error) {
        // check for error type so that we don't callback when the controller is stopped
        // on unmount
        if (!(error instanceof WaitCheckControllerAbortedError)) {
          console.log('useWatchPayIn: check: error', error)
          onPaymentError?.(error)
        }
      }
    }
    check()

    return () => controller.stop()
  }, [id, waitFor, payInHelper, onPaymentError, onPaymentSuccess])

  // this will return the payIn in the cache as the useEffect updates the cache
  return useQuery(query, { variables: { id } })
}
