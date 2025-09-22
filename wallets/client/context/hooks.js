import { useEffect, useState } from 'react'
import { useMe } from '@/components/me'
import {
  useWalletsQuery, useGenerateRandomKey, useSetKey, useIsWrongKey, useWalletLogger, useDeleteOldDb
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
  const deleteOldDb = useDeleteOldDb()
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
        // delete the old IndexedDB since wallet v2 has been released 2 months ago
        await deleteOldDb()

        // create random key before opening transaction in case we need it
        // because we can't run async code in a transaction because it will close the transaction
        // see https://javascript.info/indexeddb#transactions-autocommit
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
  }, [me?.id, db, deleteOldDb, generateRandomKey, setKey, logger])
}

export function useDeleteLocalWallets () {
  const { me } = useMe()

  useEffect(() => {
    if (!me?.id) return

    // we used to store wallets locally so this makes sure we delete them if there are any left over
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('wallet:'))
      .filter((key) => key.split(':').length < 3 || key.endsWith(me.id))
      .forEach((key) => window.localStorage.removeItem(key))
  }, [me?.id])
}
