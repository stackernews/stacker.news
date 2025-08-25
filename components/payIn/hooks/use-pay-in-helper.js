import { useApolloClient, useMutation } from '@apollo/client'
import { useCallback, useMemo } from 'react'
import { InvoiceCanceledError, InvoiceExpiredError, WalletReceiverError } from '@/wallets/client/errors'
import { GET_PAY_IN, CANCEL_PAY_IN_BOLT11, RETRY_PAY_IN } from '@/fragments/payIn'
import { FAST_POLL_INTERVAL } from '@/lib/constants'

const RECEIVER_FAILURE_REASONS = [
  'INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_FEE',
  'INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_EXPIRY',
  'INVOICE_FORWARDING_CLTV_DELTA_TOO_LOW',
  'INVOICE_FORWARDING_FAILED'
]

export default function usePayInHelper () {
  const client = useApolloClient()
  const [retryPayIn] = useMutation(RETRY_PAY_IN)
  const [cancelPayInBolt11] = useMutation(CANCEL_PAY_IN_BOLT11)

  const check = useCallback(async (id, that, { fetchPolicy = 'network-only' } = {}) => {
    const { data, error } = await client.query({ query: GET_PAY_IN, fetchPolicy, variables: { id } })
    if (error) {
      throw error
    }

    const { payInBolt11, payInFailureReason, pessimisticEnv } = data.payIn
    const { cancelledAt, expiresAt } = payInBolt11

    const expired = cancelledAt && new Date(expiresAt) < new Date(cancelledAt)
    if (expired) {
      throw new InvoiceExpiredError(payInBolt11)
    }

    if (RECEIVER_FAILURE_REASONS.includes(payInFailureReason)) {
      throw new WalletReceiverError(payInBolt11)
    }

    const failed = cancelledAt || pessimisticEnv?.error
    if (failed) {
      throw new InvoiceCanceledError(payInBolt11, pessimisticEnv?.error)
    }

    return { payIn: data.payIn, check: that(data.payIn) }
  }, [client])

  const waitCheckController = useCallback((payInId) => {
    return waitCheckPayInController(payInId, check)
  }, [check])

  const cancel = useCallback(async (payIn, { userCancel = false } = {}) => {
    const { hash, hmac } = payIn.payInBolt11
    console.log('canceling invoice:', hash)
    const { data } = await cancelPayInBolt11({ variables: { hash, hmac, userCancel } })
    return data.cancelPayInBolt11
  }, [cancelPayInBolt11])

  const retry = useCallback(async ({ payIn, newAttempt = false }, { update } = {}) => {
    console.log('retrying invoice:', payIn.payInBolt11.hash)
    const { data, error } = await retryPayIn({ variables: { payInId: payIn.id, newAttempt }, update })
    if (error) throw error

    const newPayIn = data.retryPayIn
    console.log('new payIn:', newPayIn?.payInBolt11?.hash)

    return newPayIn
  }, [retryPayIn])

  return useMemo(() => ({ cancel, retry, check, waitCheckController }), [cancel, retry, check, waitCheckController])
}

export class WaitCheckControllerAbortedError extends Error {
  constructor (payInId) {
    super(`waitCheckPayInController: aborted: ${payInId}`)
    this.name = 'WaitCheckControllerAbortedError'
    this.payInId = payInId
  }
}

function waitCheckPayInController (payInId, check) {
  const controller = new AbortController()
  const signal = controller.signal
  controller.wait = async (waitFor = payIn => payIn?.payInState === 'PAID', options) => {
    console.log('waitCheckPayInController: wait', payInId)
    let result
    return await new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          console.log('waitCheckPayInController: checking', payInId)
          result = await check(payInId, waitFor, options)
          console.log('waitCheckPayInController: checked', payInId, result)
          if (result.check) {
            resolve(result.payIn)
            clearInterval(interval)
            signal.removeEventListener('abort', abort)
          } else {
            console.info(`payIn #${payInId}: waiting for payment ...`)
          }
        } catch (err) {
          console.log('waitCheckPayInController: error', payInId, err)
          reject(err)
          clearInterval(interval)
          signal.removeEventListener('abort', abort)
        }
      }, FAST_POLL_INTERVAL)

      const abort = () => {
        console.info(`payIn #${payInId}: stopped waiting`)
        result?.check ? resolve(result.payIn) : reject(new WaitCheckControllerAbortedError(payInId))
        clearInterval(interval)
        signal.removeEventListener('abort', abort)
      }
      signal.addEventListener('abort', abort)
    })
  }

  controller.stop = () => controller.abort()

  return controller
}
