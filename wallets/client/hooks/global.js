/**
 * This file provides:
 *   - the global context for the wallets
 *   - the global hooks that are always mounted like:
 *      - fetching wallets
 *      - checking for invoices to retry
 *      - generating or reading the CryptoKey from IndexedDB if it exists
 *   - hooks to access the global context
 */
import { createContext, useContext, useEffect, useReducer, useState } from 'react'

import { useMe } from '@/components/me'
import { useIndexedDB } from '@/components/use-indexeddb'
import { isTemplate, isWallet } from '@/wallets/lib/util'
import { useWeblnEvents } from '@/wallets/lib/protocols/webln'
import { useWalletsQuery } from '@/wallets/client/hooks/query'
import { useGenerateRandomKey, useSetKey, useIsWrongKey, useDeleteOldDb } from '@/wallets/client/hooks/crypto'
import { useWalletLogger } from '@/wallets/client/hooks/logger'
import { useAutoRetryPayIns } from '@/components/payIn/hooks/use-auto-retry-pay-ins'

const WalletsContext = createContext(null)
const WalletsDispatchContext = createContext(null)

export function useWallets () {
  const { wallets } = useContext(WalletsContext)
  return wallets
}

export function useWalletsLoading () {
  const { walletsLoading } = useContext(WalletsContext)
  return walletsLoading
}

export function useTemplates () {
  const { templates } = useContext(WalletsContext)
  return templates
}

export function useWalletsError () {
  const { walletsError } = useContext(WalletsContext)
  return walletsError
}

export function useWalletsDispatch () {
  return useContext(WalletsDispatchContext)
}

export function useKey () {
  const { key } = useContext(WalletsContext)
  return key
}

export function useKeyHash () {
  const { keyHash } = useContext(WalletsContext)
  return keyHash
}

export function useKeyUpdatedAt () {
  const { keyUpdatedAt } = useContext(WalletsContext)
  return keyUpdatedAt
}

export function useKeyError () {
  const { keyError } = useContext(WalletsContext)
  return keyError
}

export function WalletsProvider ({ children }) {
  // https://react.dev/learn/scaling-up-with-reducer-and-context
  const [state, dispatch] = useReducer(walletsReducer, {
    wallets: [],
    walletsLoading: true,
    walletsError: null,
    templates: [],
    key: null,
    keyHash: null,
    keyUpdatedAt: null,
    keyError: null
  })

  return (
    <WalletsContext.Provider value={state}>
      <WalletsDispatchContext.Provider value={dispatch}>
        <WalletHooks>
          {children}
        </WalletHooks>
      </WalletsDispatchContext.Provider>
    </WalletsContext.Provider>
  )
}

function WalletHooks ({ children }) {
  useServerWallets()
  useAutoRetryPayIns()
  useKeyInit()
  useDeleteLocalWallets()
  useWeblnEvents()

  return children
}

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

export const KeyStatus = {
  KEY_STORAGE_UNAVAILABLE: 'KEY_STORAGE_UNAVAILABLE',
  WRONG_KEY: 'WRONG_KEY'
}

// wallet actions
export const SET_WALLETS = 'SET_WALLETS'
export const SET_KEY = 'SET_KEY'
export const WRONG_KEY = 'WRONG_KEY'
export const KEY_MATCH = 'KEY_MATCH'
export const KEY_STORAGE_UNAVAILABLE = 'KEY_STORAGE_UNAVAILABLE'
export const WALLETS_QUERY_ERROR = 'WALLETS_QUERY_ERROR'

function walletsReducer (state, action) {
  switch (action.type) {
    case SET_WALLETS: {
      const wallets = action.wallets
        .filter(isWallet)
        .sort((a, b) => a.priority === b.priority ? a.id - b.id : a.priority - b.priority)
      const templates = action.wallets
        .filter(isTemplate)
        .sort((a, b) => a.name.localeCompare(b.name))
      return {
        ...state,
        walletsLoading: false,
        walletsError: null,
        wallets,
        templates
      }
    }
    case WALLETS_QUERY_ERROR:
      return {
        ...state,
        walletsLoading: false,
        walletsError: action.error
      }
    case SET_KEY:
      return {
        ...state,
        key: action.key,
        keyHash: action.hash,
        keyUpdatedAt: action.updatedAt
      }
    case WRONG_KEY:
      return {
        ...state,
        keyError: KeyStatus.WRONG_KEY
      }
    case KEY_MATCH:
      return {
        ...state,
        keyError: null
      }
    case KEY_STORAGE_UNAVAILABLE:
      return {
        ...state,
        keyError: KeyStatus.KEY_STORAGE_UNAVAILABLE
      }
    default:
      return state
  }
}
