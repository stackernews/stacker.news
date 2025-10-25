import { useWalletPayment } from '@/wallets/client/hooks'
import usePayInHelper from './use-pay-in-helper'
import { useLazyQuery } from '@apollo/client'
import { FAILED_PAY_INS } from '@/fragments/payIn'
import { useMe } from '@/components/me'
import { useCallback, useEffect } from 'react'
import { WalletConfigurationError } from '@/wallets/client/errors'
import { NORMAL_POLL_INTERVAL_MS } from '@/lib/constants'

export function useAutoRetryPayIns () {
  const waitForWalletPayment = useWalletPayment()
  const payInHelper = usePayInHelper()
  const [getFailedPayIns] = useLazyQuery(FAILED_PAY_INS, { fetchPolicy: 'network-only', nextFetchPolicy: 'network-only' })
  const { me } = useMe()

  const retry = useCallback(async (payIn) => {
    const newPayIn = await payInHelper.retry(payIn)

    try {
      await waitForWalletPayment(newPayIn)
    } catch (err) {
      if (err instanceof WalletConfigurationError) {
        // consume attempt by canceling invoice
        await payInHelper.cancel(newPayIn)
      }
      throw err
    }
  }, [payInHelper, waitForWalletPayment])

  useEffect(() => {
    // we always retry failed invoices, even if the user has no wallets on any client
    // to make sure that failed payments will always show up in notifications eventually

    if (!me) return

    const retryPoll = async () => {
      let failedPayIns
      try {
        const { data, error } = await getFailedPayIns()
        if (error) throw error
        failedPayIns = data.failedPayIns
        console.log('failedPayIns', failedPayIns)
      } catch (err) {
        console.error('failed to fetch invoices to retry:', err)
        return
      }

      for (const payIn of failedPayIns) {
        try {
          await retry(payIn)
        } catch (err) {
          // some retries are expected to fail since only one client at a time is allowed to retry
          // these should show up as 'invoice not found' errors
          console.error('retry failed:', err)
        }
      }
    }

    let timeout, stopped
    const queuePoll = () => {
      timeout = setTimeout(async () => {
        try {
          await retryPoll()
        } catch (err) {
          // every error should already be handled in retryPoll
          // but this catch is a safety net to not trigger an unhandled promise rejection
          console.error('retry poll failed:', err)
        }
        if (!stopped) queuePoll()
      }, NORMAL_POLL_INTERVAL_MS)
    }

    const stopPolling = () => {
      stopped = true
      clearTimeout(timeout)
    }

    queuePoll()
    return stopPolling
  }, [me?.id, getFailedPayIns, retry])
}
