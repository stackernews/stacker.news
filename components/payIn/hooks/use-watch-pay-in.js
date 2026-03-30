import { useQuery } from '@apollo/client'
import { GET_PAY_IN_RESULT } from '@/fragments/payIn'
import usePayInHelper, { WaitCheckControllerAbortedError } from './use-pay-in-helper'
import { useEffect } from 'react'

export default function useWatchPayIn ({ id, query = GET_PAY_IN_RESULT, onPaymentError, onPaymentSuccess, waitFor }) {
  const payInHelper = usePayInHelper()

  // we use the controller in a useEffect like this so we can reuse the same logic
  // ... this controller is used in loops elsewhere where hooks are not allowed
  useEffect(() => {
    const controller = payInHelper.waitCheckController(id)

    const check = async () => {
      try {
        const payIn = await controller.wait(waitFor, { query })
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
  }, [id, waitFor, payInHelper, onPaymentError, onPaymentSuccess])

  // this will return the payIn in the cache as the useEffect updates the cache
  return useQuery(query, { variables: { id } })
}
