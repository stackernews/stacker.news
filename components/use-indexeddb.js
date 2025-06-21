import { useMe } from '@/components/me'
import { useCallback, useMemo } from 'react'

const VERSION = 2

export function useIndexedDB (dbName) {
  // TODO(wallet-v2): clean up / migrate from old databases

  const { me } = useMe()
  if (!dbName) dbName = me?.id ? `app:storage:${me.id}` : 'app:storage'

  const set = useCallback(async (storeName, key, value) => {
    const db = await _open(dbName, VERSION)

    try {
      return await _set(db, storeName, key, value)
    } finally {
      db.close()
    }
  }, [dbName])

  const get = useCallback(async (storeName, key) => {
    const db = await _open(dbName, VERSION)

    try {
      return await _get(db, storeName, key)
    } finally {
      db.close()
    }
  }, [dbName])

  const deleteDb = useCallback(async () => {
    return await _delete(dbName)
  }, [dbName])

  return useMemo(() => ({ set, get, deleteDb }), [set, get, deleteDb])
}

async function _open (dbName, version = 1) {
  const { promise, resolve, reject } = Promise.withResolvers()

  const request = window.indexedDB.open(dbName, version)

  request.onupgradeneeded = (event) => {
    try {
      const db = event.target.result
      if (!db.objectStoreNames.contains('vault')) db.createObjectStore('vault')
      if (db.objectStoreNames.contains('wallet_logs')) db.deleteObjectStore('wallet_logs')
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

async function _delete (dbName) {
  const { promise, resolve, reject } = Promise.withResolvers()

  const request = window.indexedDB.deleteDatabase(dbName)

  request.onerror = (event) => {
    reject(new IndexedDBDeleteError(event.target?.error?.message))
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

class IndexedDBDeleteError extends IndexedDBError {
  constructor (message) {
    super(message)
    this.name = 'IndexedDBDeleteError'
  }
}
