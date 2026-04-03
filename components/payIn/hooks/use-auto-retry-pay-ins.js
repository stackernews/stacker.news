import { usePreferredSendProtocolId, useWalletPayment } from '@/wallets/client/hooks'
import usePayInHelper from './use-pay-in-helper'
import { useLazyQuery } from '@apollo/client'
import { FAILED_PAY_INS } from '@/fragments/payIn'
import { useMe } from '@/components/me'
import { useEffect } from 'react'
import { WalletConfigurationError, WalletsRefreshingError } from '@/wallets/client/errors'
import { NORMAL_POLL_INTERVAL_MS } from '@/lib/constants'
import { useWalletsLoading } from '@/wallets/client/hooks/global'

export function useAutoRetryPayIns () {
  const waitForWalletPayment = useWalletPayment()
  const sendProtocolId = usePreferredSendProtocolId()
  const walletsLoading = useWalletsLoading()
  const payInHelper = usePayInHelper()
  const [getFailedPayIns] = useLazyQuery(FAILED_PAY_INS, { fetchPolicy: 'network-only', nextFetchPolicy: 'network-only' })
  const { me } = useMe()

  useEffect(() => {
    // we always retry failed invoices, even if the user has no wallets on any client
    // to make sure that failed payments will always show up in notifications eventually

    if (!me || walletsLoading) return

    let timeout
    let stopped = false
    const isStopped = () => stopped

    const retry = async (payIn) => {
      const newPayIn = await payInHelper.retry(payIn, { sendProtocolId })
      if (isStopped()) return

      // if the payIn has no bolt11, there's nothing to retry
      if (!newPayIn.payerPrivates.payInBolt11) {
        return
      }

      try {
        await waitForWalletPayment(newPayIn)
      } catch (err) {
        if (isStopped() || err instanceof WalletsRefreshingError) {
          await payInHelper.cancel(newPayIn).catch(() => {})
          return
        }
        if (err instanceof WalletConfigurationError) {
          // consume attempt by canceling invoice
          await payInHelper.cancel(newPayIn)
        }
        throw err
      }
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
  }, [me?.id, walletsLoading, sendProtocolId, getFailedPayIns, payInHelper, waitForWalletPayment])
}
