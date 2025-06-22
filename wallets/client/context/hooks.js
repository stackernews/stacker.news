import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useLazyQuery } from '@apollo/client'
import { FAILED_INVOICES } from '@/fragments/invoice'
import { NORMAL_POLL_INTERVAL } from '@/lib/constants'
import useInvoice from '@/components/use-invoice'
import { useMe } from '@/components/me'
import { useWalletsQuery, useSendWallets, useWalletPayment, useGenerateRandomKey, useSetKey, useLoadKey, useLoadOldKey, useWalletMigrationMutation, CryptoKeyRequiredError } from '@/wallets/client/hooks'
import { WalletConfigurationError } from '@/wallets/client/errors'
import { RESET_PAGE, SET_WALLETS, useWalletsDispatch } from '@/wallets/client/context'

export function useServerWallets () {
  const dispatch = useWalletsDispatch()
  const query = useWalletsQuery()

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

export function useKeyInit () {
  const { me } = useMe()
  const generateRandomKey = useGenerateRandomKey()
  const setKey = useSetKey()
  const loadKey = useLoadKey()
  const loadOldKey = useLoadOldKey()

  useEffect(() => {
    if (!me?.id) return

    async function keyInit () {
      try {
        // TODO(wallet-v2): remove this migration code and delete the old db after wallet v2 has been released for some time
        const oldKey = await loadOldKey()
        if (oldKey?.key) {
          setKey(oldKey.key)
          return
        }

        const key = await loadKey()
        if (key) {
          setKey(key)
          return
        }

        const { key: randomKey } = await generateRandomKey()
        setKey(randomKey)
      } catch (err) {
        console.error('key init failed:', err)
      }
    }
    keyInit()
  }, [me?.id, generateRandomKey, loadOldKey, setKey, loadKey])

  // TODO(wallet-v2): move or remove this, this is just for loading the key for the wallet seed
  // useEffect(() => {
  //   if (!me?.id) return
  //   async function loadKey () {
  //     const { key } = await deriveKey(
  //       'media fit youth secret combine live cupboard response enable loyal kitchen angle',
  //       'stacker21001'
  //     )
  //     await set('vault', 'key', key)
  //   }
  //   loadKey()
  // }, [me?.id])
}

// TODO(wallet-v2): remove migration code
// =============================================================
// ****** Below is the migration code for WALLET v1 -> v2 ******
//   remove when we can assume migration is complete (if ever)
// =============================================================

export function useWalletMigration () {
  const { me } = useMe()
  const localWallets = useLocalWallets()
  const walletMigration = useWalletMigrationMutation()

  useEffect(() => {
    if (!me?.id) return

    async function migrate () {
      await Promise.allSettled(
        localWallets.map(async ({ key, ...localWallet }) => {
          const name = key.split(':')[1].toUpperCase()
          try {
            await walletMigration({ ...localWallet, name })
            window.localStorage.removeItem(key)
          } catch (err) {
            if (err instanceof CryptoKeyRequiredError) {
              // key not set yet, skip this wallet
              return
            }
            console.error(`${name}: wallet migration failed:`, err)
          }
        })
      )
    }
    migrate()
  }, [me?.id, localWallets, walletMigration])
}

function useLocalWallets () {
  const { me } = useMe()
  const [wallets, setWallets] = useState([])

  useEffect(() => {
    if (!me?.id) return

    const wallets = Object.entries(window.localStorage)
      .filter(([key]) => key.startsWith('wallet:'))
      .filter(([key]) => key.split(':').length < 3 || key.endsWith(me.id))
      .reduce((acc, [key, value]) => {
        try {
          const config = JSON.parse(value)
          acc.push({ key, ...config })
        } catch (err) {
          console.error(`useLocalWallets: ${key}: invalid JSON:`, err)
        }
        return acc
      }, [])

    setWallets(wallets)
  }, [me?.id])

  return wallets
}
