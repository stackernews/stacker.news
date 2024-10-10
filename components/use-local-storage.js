import { SSR } from '@/lib/constants'
import { useMe } from './me'
import { useState, useEffect } from 'react'

// Map new namespaces to legacy namespaces
// const LEGACY_MAPPER = [
//   {
//     toLegacy: (newNamespace) => {
//       if (newNamespace[0] === 'ClientWallet') return 'wallet'
//       return undefined
//     },
//     fromLegacy: (legacyNamespace) => {
//       if (legacyNamespace === 'wallet') return ['ClientWallet']
//       return undefined
//     }
//   }
// ]

const VERSION = 1

/**
 * A react hook to use the best available local storage
 * @param {*} param0
 * @param {string} param0.namespace - the namespace of the storage
 * @param {boolean} param0.supportLegacy - whether to support legacy storage
 * @returns {array} - [backend, error]
 * @returns
 */
export default function useLocalStorage ({ database = 'default', namespace = ['default'] }) { //, supportLegacy = true , legacyMapper = LEGACY_MAPPER }) {
  const { me } = useMe()
  const [lazyBackend] = useState(() => newLazyBackend())
  const [error, setError] = useState(null)
  if (!Array.isArray(namespace)) namespace = [namespace]
  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const backend = await openLocalStorage({ database, userId: me?.id, namespace })//, supportLegacy legacyMapper })
        await lazyBackend.setBackend(backend)
      } catch (e) {
        console.error(e)
        if (isMounted) setError(e)
      }
    })()
    return () => {
      isMounted = false
      lazyBackend.close()
    }
  }, [me, database, ...namespace])
  return [lazyBackend, error]
}

/**
 * Get the best available local storage backend
 * @param {*} param0
 * @param {string} param0.userId - the user that owns the storage (defaults to 'anon' if not provided)
 * @param {string} param0.namespace - the namespace of the storage
 * @param {boolean} param0.supportLegacy - whether to support legacy storage
 * @returns {object} - the best available local storage backend
 */
export async function openLocalStorage ({ userId, database = 'default', namespace = ['default'] }) { // }, supportLegacy = true, legacyMapper = LEGACY_MAPPER }) {
  if (SSR) return newMemBackend()
  if (!userId) userId = 'anon'
  if (!Array.isArray(namespace)) namespace = [namespace]

  let backend = await newIdxDBBackend(userId, database, namespace)

  if (!backend) {
    console.warn('no local storage backend available, fallback to in memory storage')
    backend = newMemBackend()
  }

  // if (supportLegacy) backend = legacyWrapper(userId, namespace, backend, legacyMapper)
  return backend
}

export async function listLocalStorages ({ userId, database }) { // }, legacyMapper = LEGACY_MAPPER }) {
  // const idxdbNamespaces = await listIdxDBBackendNamespaces(userId, database)
  // const legacyNamespaces = listLegacyNamespaces(legacyMapper)
  // return [...new Set([...idxdbNamespaces, ...legacyNamespaces])]
  return await listIdxDBBackendNamespaces(userId, database)
}

/**
 * In memory storage backend (volatile/dummy storage)
 * @returns {object} - an in memory volatile storage backend
 */
function newMemBackend () {
  const memory = {}
  let closed = false
  return {
    isClosed: () => closed,
    set: (key, value) => { memory[key] = value },
    get: (key) => memory[key],
    unset: (key) => { delete memory[key] },
    clear: () => { Object.keys(memory).forEach(key => delete memory[key]) },
    list: () => Object.keys(memory),
    close: () => { closed = true }
  }
}

async function openIdxDB (userId, database, onupgradeneeded) {
  const fullDbName = `${database}:${userId}`
  // we keep a reference to every open idxdb connection to reuse them when possible
  if (!window.snIdxDB) window.snIdxDB = {}
  let openConnection = window.snIdxDB[fullDbName]

  const close = () => {
    openConnection.ref--
    if (openConnection.ref === 0) {
      delete window.snIdxDB[fullDbName]
      openConnection.db.close()
    }
  }

  // if for some reason the connection is outdated, we close it
  if (openConnection && openConnection.version !== VERSION) {
    close()
    openConnection = undefined
  }
  // an open connections is not available, so we open a new one
  if (!openConnection) {
    openConnection = { version: VERSION, ref: 1, db: null, close }
    openConnection.db = await new Promise((resolve, reject) => {
      const request = window.indexedDB.open(fullDbName, VERSION)
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (onupgradeneeded) onupgradeneeded(db)
      }
      request.onsuccess = (event) => {
        const db = event.target.result
        if (!db?.transaction) reject(new Error('unsupported implementation'))
        else resolve(db)
      }
      request.onerror = reject
    })
    window.snIdxDB[fullDbName] = openConnection
  } else {
    // increase the reference count
    openConnection.ref++
  }
  return openConnection
}

/**
 * An IndexedDB based persistent storage
 * @param {string} userId - the user that owns the storage
 * @param {string} database - the database name
 *
 * @returns {object} - an indexedDB persistent storage backend
 */
async function newIdxDBBackend (userId, database, namespace) {
  if (!window.indexedDB) return undefined
  if (!namespace) throw new Error('missing namespace')
  if (!Array.isArray(namespace) || !namespace.length || namespace.find(n => !n || typeof n !== 'string')) throw new Error('invalid namespace. must be a non-empty array of strings')
  if (namespace.find(n => n.includes(':'))) throw new Error('invalid namespace. must not contain ":"')

  namespace = namespace.join(':')

  const openConnection = await openIdxDB(userId, database, (db) => {
    db.createObjectStore(namespace, { keyPath: 'key' })
  })
  let closed = false
  return {
    isClosed: () => closed,
    set: async (key, value) => {
      const tx = openConnection.db.transaction([namespace], 'readwrite')
      const objectStore = tx.objectStore(namespace)
      objectStore.put({ key, value })
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = reject
      })
    },
    get: async (key) => {
      const tx = openConnection.db.transaction([namespace], 'readonly')
      const objectStore = tx.objectStore(namespace)
      const request = objectStore.get(key)
      return await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result?.value)
        request.onerror = reject
      })
    },
    unset: async (key) => {
      const tx = openConnection.db.transaction([namespace], 'readwrite')
      const objectStore = tx.objectStore(namespace)
      objectStore.delete(key)
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = reject
      })
    },
    clear: async () => {
      const tx = openConnection.db.transaction([namespace], 'readwrite')
      const objectStore = tx.objectStore(namespace)
      objectStore.clear()
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = reject
      })
    },
    list: async () => {
      const tx = openConnection.db.transaction([namespace], 'readonly')
      const objectStore = tx.objectStore(namespace)
      const request = objectStore.getAllKeys()
      return await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = reject
      })
    },
    close: () => {
      if (closed) return
      closed = true
      openConnection.close()
    }
  }
}

/**
 * List all the namespaces used in an IndexedDB database
 * @param {*} userId - the user that owns the storage
 * @param {*} database - the database name
 * @returns {array} - an array of namespace names
 */
async function listIdxDBBackendNamespaces (userId, database) {
  if (!window.indexedDB) return []
  return await new Promise((resolve, reject) => {
    const request = window.indexedDB.open(`${database}:${userId}`, VERSION)
    request.onsuccess = (event) => {
      const db = event.target.result
      const namespaces = Array.from(db.objectStoreNames).map(n => n.split(':'))
      db.close()
      resolve(namespaces)
    }
    request.onerror = reject
  })
}

/**
 * A wrapper that provides backward compatibility with legacy storage
 * @param {string} userId - the user that owns the storage
 * @param {string} namespace  - the namespace of the storage
 * @param {*} backend - the new storage backend
 * @returns {object} - a wrapped storage backend that supports legacy storage
 */
// function legacyWrapper (userId, namespace, backend, legacyMapper) {
//   let legacyNamespace
//   for (const mapper of legacyMapper) {
//     legacyNamespace = mapper.toLegacy(namespace)
//     if (legacyNamespace) break
//   }
//   return {
//     set: async (key, value) => {
//       await backend.set(key, value)
//       if (legacyNamespace) window.localStorage.removeItem(`${legacyNamespace}:${key}:${userId}`)
//     },
//     get: async (key) => {
//       if (legacyNamespace) {
//         try {
//           const v = JSON.parse(window.localStorage.getItem(`${legacyNamespace}:${key}:${userId}`) || null)
//           if (v) return v
//         } catch (e) {
//           console.error('could not parse legacy storage:', e)
//         }
//       }
//       return await backend.get(key)
//     },
//     unset: async (key) => {
//       if (legacyNamespace) window.localStorage.removeItem(`${legacyNamespace}:${key}:${userId}`)
//       await backend.unset(key)
//     },
//     clear: async () => {
//       if (legacyNamespace) {
//         for (const k of Object.keys(window.localStorage)) {
//           if (k.startsWith(`${legacyNamespace}:` && k.endsWith(`:${userId}`))) {
//             window.localStorage.removeItem(k)
//           }
//         }
//       }
//       await backend.clear()
//     },
//     list: async () => {
//       const keys = new Set(await backend.list())
//       if (legacyNamespace) {
//         for (const k of Object.keys(window.localStorage)) {
//           if (k.startsWith(`${legacyNamespace}:` && k.endsWith(`:${userId}`))) {
//             keys.add(k.substring(legacyNamespace.length + 1, k.length - userId.length))
//           }
//         }
//       }
//       return Array.from(keys)
//     },
//     close: () => backend.close(),
//     isClosed: () => backend.isClosed()
//   }
// }

/**
 * List all the namespaces used in legacy storage
 * @param {*} legacyMapper
 * @returns {array} - an array of namespace names
 */
// function listLegacyNamespaces (legacyMapper = LEGACY_MAPPER) {
//   const namespaces = new Set()
//   for (const key of Object.keys(window.localStorage)) {
//     const [namespace] = key.split(':')
//     if (namespace) {
//       let newNamespace
//       for (const mapper of legacyMapper) {
//         newNamespace = mapper.fromLegacy(namespace)
//         if (newNamespace) break
//       }
//       if (newNamespace) {
//         namespaces.add(newNamespace)
//       }
//     }
//   }
//   return Array.from(namespaces)
// }

/**
 * A backend that enqueues all the operations until the real backend is available
 * @param {*} userId - the user that owns the storage
 * @param {*} namespace - the namespace of the storage
 * @param {*} backendSpawnerPromise - a promise that resolves to the real backend
 */
function newLazyBackend () {
  let backend = null
  const executionQueue = []
  let closed = false

  const enqueueOrExecute = (method, ...args) => {
    if (backend) return backend[method](...args)
    return new Promise((resolve, reject) => {
      executionQueue.push({ method, args, resolve, reject })
    })
  }

  let queueFlushPromise = Promise.resolve()

  return {
    isClosed: () => closed,
    setBackend: async (b) => {
      if (backend) {
        await queueFlushPromise
        await backend.close()
      }
      backend = b
      queueFlushPromise = new Promise((resolve) => {
        let flushQueue = Promise.resolve()
        while (executionQueue.length && !backend.isClosed()) {
          const { method, args, resolve, reject } = executionQueue.shift()
          flushQueue = flushQueue.then(async () => {
            try {
              resolve(await backend[method](...args))
            } catch (e) {
              reject(e)
            }
          })
        }
        flushQueue.then(() => resolve())
      })
    },
    set: (key, value) => enqueueOrExecute('set', key, value),
    get: (key) => enqueueOrExecute('get', key),
    unset: (key) => enqueueOrExecute('unset', key),
    clear: () => enqueueOrExecute('clear'),
    list: () => enqueueOrExecute('list'),
    close: async () => {
      closed = true
      if (backend) {
        await queueFlushPromise
        return backend.close()
      }
    }
  }
}
