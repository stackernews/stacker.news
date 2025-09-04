import { useEffect, useState } from 'react'
import { useMe } from '@/components/me'
import {
  useWalletsQuery, useGenerateRandomKey, useSetKey, useLoadKey, useLoadOldKey,
  useWalletMigrationMutation, CryptoKeyRequiredError, useIsWrongKey,
  useWalletLogger
} from '@/wallets/client/hooks'
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

export function useKeyInit () {
  const { me } = useMe()

  const dispatch = useWalletsDispatch()
  const wrongKey = useIsWrongKey()

  const logger = useWalletLogger()

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

        // load old key and create random key before opening transaction in case we need them
        // because we can't run async code in a transaction because it will close the transaction
        // see https://javascript.info/indexeddb#transactions-autocommit
        const oldKeyAndHash = await loadOldKey()
        const { key: randomKey, hash: randomHash } = await generateRandomKey()

        // run read and write in one transaction to avoid race conditions
        const { key, hash, updatedAt } = await new Promise((resolve, reject) => {
          const tx = db.transaction('vault', 'readwrite')
          const read = tx.objectStore('vault').get('key')

          read.onerror = () => {
            logger.debug('key init: error reading key: ' + read.error)
            reject(read.error)
          }

          read.onsuccess = () => {
            if (read.result) {
              // return key+hash found in db
              logger.debug('key init: key found in IndexedDB')
              return resolve(read.result)
            }

            if (oldKeyAndHash) {
              // return key+hash found in old db
              logger.debug('key init: key found in old IndexedDB')
              return resolve(oldKeyAndHash)
            }

            // no key found, write and return generated random key
            const updatedAt = Date.now()
            const write = tx.objectStore('vault').put({ key: randomKey, hash: randomHash, updatedAt }, 'key')

            write.onerror = () => {
              logger.debug('key init: error writing new random key: ' + write.error)
              reject(write.error)
            }

            write.onsuccess = (event) => {
              // return key+hash we just wrote to db
              logger.debug('key init: saved new random key')
              resolve({ key: randomKey, hash: randomHash, updatedAt })
            }
          }
        })

        await setKey({ key, hash, updatedAt }, { updateDb: false })
      } catch (err) {
        logger.debug('key init: error: ' + err)
        console.error('key init: error:', err)
      }
    }
    keyInit()
  }, [me?.id, db, generateRandomKey, loadOldKey, setKey, loadKey, logger])
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
