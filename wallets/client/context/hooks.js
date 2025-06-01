import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useLazyQuery, useQuery } from '@apollo/client'
import { FAILED_INVOICES } from '@/fragments/invoice'
import { WALLETS } from '@/wallets/client/fragments'
import { NORMAL_POLL_INTERVAL } from '@/lib/constants'
import useInvoice from '@/components/use-invoice'
import { useMe } from '@/components/me'
import { useSendWallets, useWalletPayment } from '@/wallets/client/hooks'
import { WalletConfigurationError } from '@/wallets/client/errors'
import { RESET_PAGE, SET_WALLETS, useWalletsDispatch } from '@/wallets/client/context'

export function useServerWallets () {
  const dispatch = useWalletsDispatch()
  const query = useQuery(WALLETS)

  useEffect(() => {
    if (query.error) {
      console.error('failed to fetch wallets:', query.error)
      return
    }
    if (query.loading) return
    dispatch({ type: SET_WALLETS, wallets: query.data.wallets })
  }, [query])
}

export function usePageNavigation () {
  const dispatch = useWalletsDispatch()
  const router = useRouter()

  useEffect(() => {
    function handleRouteChangeComplete (url) {
      if (!url.startsWith('/wallets')) {
        dispatch({ type: RESET_PAGE })
      }
    }
    router.events.on('routeChangeComplete', handleRouteChangeComplete)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChangeComplete)
    }
  }, [router, dispatch])
}

export function useAutomatedRetries () {
  const wallets = useSendWallets()
  const waitForWalletPayment = useWalletPayment()
  const invoiceHelper = useInvoice()
  const [getFailedInvoices] = useLazyQuery(FAILED_INVOICES, { fetchPolicy: 'network-only', nextFetchPolicy: 'network-only' })
  const { me } = useMe()

  const retry = useCallback(async (invoice) => {
    const newInvoice = await invoiceHelper.retry({ ...invoice, newAttempt: true })

    try {
      await waitForWalletPayment(newInvoice)
    } catch (err) {
      if (err instanceof WalletConfigurationError) {
        // consume attempt by canceling invoice
        await invoiceHelper.cancel(newInvoice)
      }
      throw err
    }
  }, [invoiceHelper, waitForWalletPayment])

  useEffect(() => {
    // we always retry failed invoices, even if the user has no wallets on any client
    // to make sure that failed payments will always show up in notifications eventually

    if (!me) return

    const retryPoll = async () => {
      let failedInvoices
      try {
        const { data, error } = await getFailedInvoices()
        if (error) throw error
        failedInvoices = data.failedInvoices
      } catch (err) {
        console.error('failed to fetch invoices to retry:', err)
        return
      }

      for (const inv of failedInvoices) {
        try {
          await retry(inv)
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
      }, NORMAL_POLL_INTERVAL)
    }

    const stopPolling = () => {
      stopped = true
      clearTimeout(timeout)
    }

    queuePoll()
    return stopPolling
  }, [me?.id, wallets, getFailedInvoices, retry])
}
