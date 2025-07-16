import { useCallback, useEffect, useState } from 'react'
import { useLazyQuery } from '@apollo/client'
import { FAILED_INVOICES } from '@/fragments/invoice'
import { NORMAL_POLL_INTERVAL } from '@/lib/constants'
import useInvoice from '@/components/use-invoice'
import { useMe } from '@/components/me'
import {
  useWalletsQuery, useWalletPayment, useGenerateRandomKey, useSetKey, useLoadKey, useLoadOldKey,
  useWalletMigrationMutation, CryptoKeyRequiredError, useIsWrongKey
} from '@/wallets/client/hooks'
import { WalletConfigurationError } from '@/wallets/client/errors'
import { SET_WALLETS, WRONG_KEY, KEY_MATCH, useWalletsDispatch, WALLETS_QUERY_ERROR, KEY_STORAGE_UNAVAILABLE } from '@/wallets/client/context'
import { useIndexedDB } from '@/components/use-indexeddb'

export function useServerWallets () {
  const dispatch = useWalletsDispatch()
  const query = useWalletsQuery()

  useEffect(() => {
    if (query.error) {
      console.error('failed to fetch wallets:', query.error)
      dispatch({ type: WALLETS_QUERY_ERROR, error: query.error })
      return
    }
    if (query.loading) return
    dispatch({ type: SET_WALLETS, wallets: query.data.wallets })
  }, [query])
}

export function useKeyCheck () {
}

export function useAutomatedRetries () {
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
  }, [me?.id, getFailedInvoices, retry])
}

export function useKeyInit () {
  const { me } = useMe()

  const dispatch = useWalletsDispatch()
  const wrongKey = useIsWrongKey()

  useEffect(() => {
    if (typeof window.indexedDB === 'undefined') {
      dispatch({ type: KEY_STORAGE_UNAVAILABLE })
    } else if (wrongKey) {
      dispatch({ type: WRONG_KEY })
    } else {
      dispatch({ type: KEY_MATCH })
    }
  }, [wrongKey, dispatch])

  const generateRandomKey = useGenerateRandomKey()
  const setKey = useSetKey()
  const loadKey = useLoadKey()
  const loadOldKey = useLoadOldKey()
  const [db, setDb] = useState(null)
  const { open } = useIndexedDB()

  useEffect(() => {
    if (!me?.id) return
    let db

    async function openDb () {
      try {
        db = await open()
        setDb(db)
      } catch (err) {
        console.error('failed to open indexeddb:', err)
      }
    }
    openDb()

    return () => {
      db?.close()
      setDb(null)
    }
  }, [me?.id, open])

  useEffect(() => {
    if (!me?.id || !db) return

    async function keyInit () {
      try {
        // TODO(wallet-v2): remove migration code
        //   and delete the old IndexedDB after wallet v2 has been released for some time
        const oldKeyAndHash = await loadOldKey()
        if (oldKeyAndHash) {
          // return key found in old db and save it to new db
          await setKey(oldKeyAndHash)
          return
        }

        // create random key before opening transaction in case we need it
        // and because we can't run async code in a transaction because it will close the transaction
        // see https://javascript.info/indexeddb#transactions-autocommit
        const { key: randomKey, hash: randomHash } = await generateRandomKey()

        // run read and write in one transaction to avoid race conditions
        const { key, hash } = await new Promise((resolve, reject) => {
          const tx = db.transaction('vault', 'readwrite')
          const read = tx.objectStore('vault').get('key')

          read.onerror = () => {
            reject(read.error)
          }

          read.onsuccess = () => {
            if (read.result) {
              // return key+hash found in db
              return resolve(read.result)
            }

            // no key found, write and return generated random key
            const write = tx.objectStore('vault').put({ key: randomKey, hash: randomHash }, 'key')

            write.onerror = () => {
              reject(write.error)
            }

            write.onsuccess = (event) => {
              // return key+hash we just wrote to db
              resolve({ key: randomKey, hash: randomHash })
            }
          }
        })

        await setKey({ key, hash })
      } catch (err) {
        console.error('key init failed:', err)
      }
    }
    keyInit()
  }, [me?.id, db, generateRandomKey, loadOldKey, setKey, loadKey])
}

// TODO(wallet-v2): remove migration code
// =============================================================
// ****** Below is the migration code for WALLET v1 -> v2 ******
//   remove when we can assume migration is complete (if ever)
// =============================================================

export function useWalletMigration () {
  const { me } = useMe()
  const { migrate: walletMigration, ready } = useWalletMigrationMutation()

  useEffect(() => {
    if (!me?.id || !ready) return

    async function migrate () {
      const localWallets = Object.entries(window.localStorage)
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
  }, [ready, me?.id, walletMigration])
}
