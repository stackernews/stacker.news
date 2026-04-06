import { usePreferredSendProtocolId, useWalletPayment } from '@/wallets/client/hooks'
import usePayInHelper from './use-pay-in-helper'
import { useLazyQuery } from '@apollo/client'
import { FAILED_PAY_INS } from '@/fragments/payIn'
import { useMe } from '@/components/me'
import { useEffect } from 'react'
import { NORMAL_POLL_INTERVAL_MS } from '@/lib/constants'
import { useWalletSendReady } from '@/wallets/client/hooks/global'
import { retryFailedPayIn } from './auto-retry-utils'

export function useAutoRetryPayIns () {
  const waitForWalletPayment = useWalletPayment()
  const sendProtocolId = usePreferredSendProtocolId()
  const walletSendReady = useWalletSendReady()
  const payInHelper = usePayInHelper()
  const [getFailedPayIns] = useLazyQuery(FAILED_PAY_INS, { fetchPolicy: 'network-only', nextFetchPolicy: 'network-only' })
  const { me } = useMe()

  useEffect(() => {
    // we always retry failed invoices, even if the user has no wallets on any client
    // to make sure that failed payments will always show up in notifications eventually

    if (!me || !walletSendReady) return

    let timeout
    let stopped = false
    const isStopped = () => stopped

    const retry = async (payIn) => {
      await retryFailedPayIn(payIn, {
        sendProtocolId,
        payInHelper,
        waitForWalletPayment,
        isStopped
      })
    }

    const retryPoll = async () => {
      if (isStopped()) return

      let failedPayIns
      try {
        const { data, error } = await getFailedPayIns()
        if (error) throw error
        failedPayIns = data.failedPayIns
      } catch (err) {
        console.error('failed to fetch invoices to retry:', err)
        return
      }

      for (const payIn of failedPayIns) {
        if (isStopped()) return

        try {
          await retry(payIn)
        } catch (err) {
          // some retries are expected to fail since only one client at a time is allowed to retry
          // these should show up as 'invoice not found' errors
          console.error('retry failed:', err)
        }
      }
    }

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
  }, [me?.id, walletSendReady, sendProtocolId, getFailedPayIns, payInHelper, waitForWalletPayment])
}
