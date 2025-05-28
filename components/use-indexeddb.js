import { useMe } from '@/components/me'
import { useCallback } from 'react'

const VERSION = 1

export function useIndexedDB () {
  // TODO(wallet-v2): clean up / migrate from old databases

  const { me } = useMe()
  const dbName = `app:storage:${me.id}`

  const set = useCallback(async (storeName, key, value) => {
    if (!me?.id) throw new IndexedDBOpenError('not logged in')

    const db = await _open(dbName, VERSION)

    try {
      return await _set(db, storeName, key, value)
    } finally {
      db.close()
    }
  }, [dbName])

  const get = useCallback(async (storeName, key) => {
    if (!me?.id) throw new IndexedDBOpenError('not logged in')

    const db = await _open(dbName, VERSION)

    try {
      return await _get(db, storeName, key)
    } finally {
      db.close()
    }
  }, [dbName])

  return { set, get }
}

async function _open (dbName, version = 1) {
  const { promise, resolve, reject } = Promise.withResolvers()

  const request = window.indexedDB.open(dbName, version)

  request.onupgradeneeded = (event) => {
    try {
      const db = event.target.result
      db.createObjectStore('vault')
    } catch (error) {
      reject(new IndexedDBOpenError(`upgrade failed: ${error?.message}`))
    }
  }

  request.onerror = (event) => {
    reject(new IndexedDBOpenError(request.error?.message))
  }

  request.onsuccess = (event) => {
    const db = request.result
    // TODO(wallet-v2): listen for 'versionchange' event even though we open and close the db for each request?
    resolve(db)
  }

  return promise
}

async function _set (db, storeName, key, value) {
  const { promise, resolve, reject } = Promise.withResolvers()

  let request
  try {
    request = db
      .transaction(storeName, 'readwrite')
      .objectStore(storeName)
      .put(value, key)
  } catch (error) {
    reject(new IndexedDBSetError(error?.message))
    return promise
  }

  request.onerror = (event) => {
    reject(new IndexedDBSetError(event.target?.error?.message))
  }

  request.onsuccess = () => {
    resolve(request.result)
  }

  return promise
}

async function _get (db, storeName, key) {
  const { promise, resolve, reject } = Promise.withResolvers()

  let request
  try {
    request = db.transaction(storeName).objectStore(storeName)
      .get(key)
  } catch (error) {
    reject(new IndexedDBGetError(error?.message))
    return promise
  }

  request.onerror = (event) => {
    reject(new IndexedDBGetError(event.target?.error?.message))
  }

  request.onsuccess = () => {
    resolve(request.result)
  }

  return promise
}

class IndexedDBError extends Error {
  constructor (message) {
    super(message)
    this.name = 'IndexedDBError'
  }
}

class IndexedDBOpenError extends IndexedDBError {
  constructor (message) {
    super(message)
    this.name = 'IndexedDBOpenError'
  }
}

class IndexedDBSetError extends IndexedDBError {
  constructor (message) {
    super(message)
    this.name = 'IndexedDBSetError'
  }
}

class IndexedDBGetError extends IndexedDBError {
  constructor (message) {
    super(message)
    this.name = 'IndexedDBGetError'
  }
}
