import { RETRY_PAY_IN } from '@/fragments/payIn'
import usePayInMutation from './use-pay-in-mutation'

export default function useRetryPayIn (payInId, mutationOptions = {}) {
  const [retryPayIn] = usePayInMutation(RETRY_PAY_IN, { ...mutationOptions, variables: { payInId } })
  return retryPayIn
}
