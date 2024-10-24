import { SSR } from '@/lib/constants'
import { useMe } from './me'
import { useEffect, useRef } from 'react'
import createTaskQueue from '@/lib/task-queue'

const VERSION = 1

/**
 * A react hook to use the local storage
 * It handles the lifecycle of the storage, opening and closing it as needed.
 *
 * @param {*} options
 * @param {string} options.database - the database name
 * @param {[string]} options.namespace - the namespace of the storage
 * @returns {[object]} - the local storage
 */
export default function useLocalStorage ({ database = 'default', namespace = ['default'] }) {
  const { me } = useMe()
  if (!Array.isArray(namespace)) namespace = [namespace]
  const joinedNamespace = namespace.join(':')
  const storage = useRef(openLocalStorage({ database, userId: me?.id, namespace }))

  useEffect(() => {
    const currentStorage = storage.current
    const newStorage = openLocalStorage({ database, userId: me?.id, namespace })
    storage.current = newStorage
    if (currentStorage)currentStorage.close()
    return () => {
      newStorage.close()
    }
  }, [me, database, joinedNamespace])

  return [{
    set: (key, value) => storage.current.set(key, value),
    get: (key) => storage.current.get(key),
    unset: (key) => storage.current.unset(key),
    clear: () => storage.current.clear(),
    list: () => storage.current.list()
  }]
}

/**
 * Open a local storage.
 * This is an abstraction on top of IndexedDB or, when not available, an in-memory storage.
 * A combination of userId, database and namespace is used to efficiently separate different storage units.
 * Namespaces can be an array of strings, that will be internally joined to form a single namespace.
 *
 * @param {*} options
 * @param {string} options.userId - the user that owns the storage (anon if not provided)
 * @param {string} options.database - the database name (default if not provided)
 * @param {[string]} options.namespace - the namespace of the storage (default if not provided)
 * @returns {object} - the local storage
 * @throws Error if the namespace is invalid
 */
export function openLocalStorage ({ userId, database = 'default', namespace = ['default'] }) {
  if (!userId) userId = 'anon'
  if (!Array.isArray(namespace)) namespace = [namespace]
  if (SSR) return createMemBackend(userId, namespace)

  let backend = newIdxDBBackend(userId, database, namespace)

  if (!backend) {
    console.warn('no local storage backend available, fallback to in memory storage')
    backend = createMemBackend(userId, namespace)
  }
  return backend
}

export async function listLocalStorages ({ userId, database }) {
  if (SSR) return []
  return await listIdxDBBackendNamespaces(userId, database)
}

/**
 * In memory storage backend (volatile/dummy storage)
 */
function createMemBackend (userId, namespace) {
  const joinedNamespace = userId + ':' + namespace.join(':')
  let memory
  if (SSR) {
    memory = {}
  } else {
    if (!window.snMemStorage) window.snMemStorage = {}
    memory = window.snMemStorage[joinedNamespace]
    if (!memory) window.snMemStorage[joinedNamespace] = memory = {}
  }
  return {
    set: (key, value) => { memory[key] = value },
    get: (key) => memory[key],
    unset: (key) => { delete memory[key] },
    clear: () => { Object.keys(memory).forEach(key => delete memory[key]) },
    list: () => Object.keys(memory),
    close: () => { }
  }
}

/**
 * Open an IndexedDB connection
 * @param {*} userId
 * @param {*} database
 * @param {*} onupgradeneeded
 * @param {*} queue
 * @returns {object} - an open connection
 * @throws Error if the connection cannot be opened
 */
async function openIdxDB (userId, database, onupgradeneeded, queue) {
  const fullDbName = `${database}:${userId}`
  // we keep a reference to every open indexed db connection
  // to reuse them whenever possible
  if (window && !window.snIdxDB) window.snIdxDB = {}
  let openConnection = window?.snIdxDB?.[fullDbName]

  const close = () => {
    const conn = openConnection
    conn.ref--
    if (conn.ref === 0) { // close the connection for real if nothing is using it
      if (window?.snIdxDB) delete window.snIdxDB[fullDbName]
      queue.enqueue(() => {
        conn.db.close()
      })
    }
  }

  // if for any reason the connection is outdated, we close it
  if (openConnection && openConnection.version !== VERSION) {
    close()
    openConnection = undefined
  }
  // an open connections is not available, so we create a new one
  if (!openConnection) {
    openConnection = {
      version: VERSION,
      ref: 1, // we need a ref count to know when to close the connection for real
      db: null,
      close
    }
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
 * @returns {object} - an indexedDB persistent storage
 * @throws Error if the namespace is invalid
 */
function newIdxDBBackend (userId, database, namespace) {
  if (!window.indexedDB) return undefined
  if (!namespace) throw new Error('missing namespace')
  if (!Array.isArray(namespace) || !namespace.length || namespace.find(n => !n || typeof n !== 'string')) throw new Error('invalid namespace. must be a non-empty array of strings')
  if (namespace.find(n => n.includes(':'))) throw new Error('invalid namespace. must not contain ":"')

  namespace = namespace.join(':')

  const queue = createTaskQueue()

  let openConnection = null
  let closed = false
  const initialize = async () => {
    if (!openConnection) {
      openConnection = await openIdxDB(userId, database, (db) => {
        db.createObjectStore(database, { keyPath: ['namespace', 'key'] })
      }, queue)
    }
  }

  return {
    set: async (key, value) => {
      await queue.enqueue(async () => {
        await initialize()
        const tx = openConnection.db.transaction([database], 'readwrite')
        const objectStore = tx.objectStore(database)
        objectStore.put({ namespace, key, value })
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve
          tx.onerror = reject
        })
      })
    },
    get: async (key) => {
      return await queue.enqueue(async () => {
        await initialize()
        const tx = openConnection.db.transaction([database], 'readonly')
        const objectStore = tx.objectStore(database)
        const request = objectStore.get([namespace, key])
        return await new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result?.value)
          request.onerror = reject
        })
      })
    },
    unset: async (key) => {
      await queue.enqueue(async () => {
        await initialize()
        const tx = openConnection.db.transaction([database], 'readwrite')
        const objectStore = tx.objectStore(database)
        objectStore.delete([namespace, key])
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve
          tx.onerror = reject
        })
      })
    },
    clear: async () => {
      await queue.enqueue(async () => {
        await initialize()
        const tx = openConnection.db.transaction([database], 'readwrite')
        const objectStore = tx.objectStore(database)
        objectStore.clear()
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve
          tx.onerror = reject
        })
      })
    },
    list: async () => {
      return await queue.enqueue(async () => {
        await initialize()
        const tx = openConnection.db.transaction([database], 'readonly')
        const objectStore = tx.objectStore(database)
        const keys = []
        return await new Promise((resolve, reject) => {
          const request = objectStore.openCursor()
          request.onsuccess = (event) => {
            const cursor = event.target.result
            if (cursor) {
              if (cursor.key[0] === namespace) {
                keys.push(cursor.key[1]) // Push only the 'key' part of the composite key
              }
              cursor.continue()
            } else {
              resolve(keys)
            }
          }
          request.onerror = reject
        })
      })
    },
    close: async () => {
      if (closed) return
      closed = true
      queue.enqueue(async () => {
        if (openConnection) await openConnection.close()
      })
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
  if (!window?.indexedDB) return []
  const queue = createTaskQueue()
  const openConnection = await openIdxDB(userId, database, null, queue)
  try {
    const list = await queue.enqueue(async () => {
      const objectStore = openConnection.db.transaction([database], 'readonly').objectStore(database)
      const namespaces = new Set()
      return await new Promise((resolve, reject) => {
        const request = objectStore.openCursor()
        request.onsuccess = (event) => {
          const cursor = event.target.result
          if (cursor) {
            namespaces.add(cursor.key[0])
            cursor.continue()
          } else {
            resolve(Array.from(namespaces).map(n => n.split(':')))
          }
        }
        request.onerror = reject
      })
    })
    return list
  } finally {
    openConnection.close()
  }
}
