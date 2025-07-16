import { useMe } from '@/components/me'
import { useCallback, useMemo } from 'react'

const VERSION = 2

export function useIndexedDB (dbName) {
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

  const open = useCallback(async () => {
    return await _open(dbName, VERSION)
  }, [dbName])

  return useMemo(() => ({ set, get, deleteDb, open }), [set, get, deleteDb, open])
}

async function _open (dbName, version = 1) {
  return await new Promise((resolve, reject) => {
    if (typeof window.indexedDB === 'undefined') {
      return reject(new IndexedDBOpenError('IndexedDB unavailable'))
    }

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
      resolve(db)
    }
  })
}

async function _set (db, storeName, key, value) {
  return await new Promise((resolve, reject) => {
    let request
    try {
      request = db
        .transaction(storeName, 'readwrite')
        .objectStore(storeName)
        .put(value, key)
    } catch (error) {
      return reject(new IndexedDBSetError(error?.message))
    }

    request.onerror = (event) => {
      reject(new IndexedDBSetError(event.target?.error?.message))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

async function _get (db, storeName, key) {
  return await new Promise((resolve, reject) => {
    let request
    try {
      request = db
        .transaction(storeName)
        .objectStore(storeName)
        .get(key)
    } catch (error) {
      return reject(new IndexedDBGetError(error?.message))
    }

    request.onerror = (event) => {
      reject(new IndexedDBGetError(event.target?.error?.message))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

async function _delete (dbName) {
  return await new Promise((resolve, reject) => {
    if (typeof window.indexedDB === 'undefined') {
      return reject(new IndexedDBOpenError('IndexedDB unavailable'))
    }

    const request = window.indexedDB.deleteDatabase(dbName)

    request.onerror = (event) => {
      reject(new IndexedDBDeleteError(event.target?.error?.message))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
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
