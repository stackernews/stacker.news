import { useState, useEffect, useCallback, useRef } from 'react'

function useIndexedDB (dbName, storeName, version = 1, indices = []) {
  const [db, setDb] = useState(null)
  const [error, setError] = useState(null)
  const [notSupported, setNotSupported] = useState(false)
  const operationQueue = useRef([])

  const handleError = useCallback((error) => {
    console.error('IndexedDB error:', error)
    setError(error)
  }, [])

  const processQueue = useCallback((db) => {
    if (!db) return

    try {
      // try to run a noop to see if the db is ready
      db.transaction(storeName)
      while (operationQueue.current.length > 0) {
        const operation = operationQueue.current.shift()
        operation(db)
      }
    } catch (error) {
      handleError(error)
    }
  }, [storeName, handleError])

  useEffect(() => {
    let isMounted = true
    let request
    try {
      if (!window.indexedDB) {
        console.log('IndexedDB is not supported')
        setNotSupported(true)
        return
      }

      request = window.indexedDB.open(dbName, version)

      request.onerror = (event) => {
        handleError(new Error('Error opening database'))
      }

      request.onsuccess = (event) => {
        if (isMounted) {
          const database = event.target.result
          database.onversionchange = () => {
            database.close()
            setDb(null)
            handleError(new Error('Database is outdated, please reload the page'))
          }
          setDb(database)
          processQueue(database)
        }
      }

      request.onupgradeneeded = (event) => {
        const database = event.target.result
        try {
          const store = database.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true })

          indices.forEach(index => {
            store.createIndex(index.name, index.keyPath, index.options)
          })
        } catch (error) {
          handleError(new Error('Error upgrading database: ' + error.message))
        }
      }
    } catch (error) {
      handleError(new Error('Error opening database: ' + error.message))
    }

    return () => {
      isMounted = false
      if (db) {
        db.close()
      }
    }
  }, [dbName, storeName, version, indices, handleError, processQueue])

  const queueOperation = useCallback((operation) => {
    if (notSupported) {
      return Promise.reject(new Error('IndexedDB is not supported'))
    }
    if (error) {
      return Promise.reject(new Error('Database error: ' + error.message))
    }

    return new Promise((resolve, reject) => {
      const wrappedOperation = (db) => {
        try {
          const result = operation(db)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }

      operationQueue.current.push(wrappedOperation)
      processQueue(db)
    })
  }, [processQueue, db, notSupported, error])

  const add = useCallback((value) => {
    return queueOperation((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite')
        const store = transaction.objectStore(storeName)
        const request = store.add(value)

        request.onerror = () => reject(new Error('Error adding data'))
        request.onsuccess = () => resolve(request.result)
      })
    })
  }, [queueOperation, storeName])

  const get = useCallback((key) => {
    return queueOperation((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly')
        const store = transaction.objectStore(storeName)
        const request = store.get(key)

        request.onerror = () => reject(new Error('Error getting data'))
        request.onsuccess = () => resolve(request.result ? request.result : undefined)
      })
    })
  }, [queueOperation, storeName])

  const getAll = useCallback(() => {
    return queueOperation((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly')
        const store = transaction.objectStore(storeName)
        const request = store.getAll()

        request.onerror = () => reject(new Error('Error getting all data'))
        request.onsuccess = () => resolve(request.result)
      })
    })
  }, [queueOperation, storeName])

  const update = useCallback((key, value) => {
    return queueOperation((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite')
        const store = transaction.objectStore(storeName)
        const request = store.get(key)

        request.onerror = () => reject(new Error('Error updating data'))
        request.onsuccess = () => {
          const updatedValue = { ...request.result, ...value }
          const updateRequest = store.put(updatedValue)
          updateRequest.onerror = () => reject(new Error('Error updating data'))
          updateRequest.onsuccess = () => resolve(updateRequest.result)
        }
      })
    })
  }, [queueOperation, storeName])

  const remove = useCallback((key) => {
    return queueOperation((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite')
        const store = transaction.objectStore(storeName)
        const request = store.delete(key)

        request.onerror = () => reject(new Error('Error removing data'))
        request.onsuccess = () => resolve()
      })
    })
  }, [queueOperation, storeName])

  const clear = useCallback((indexName = null, query = null) => {
    return queueOperation((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite')
        const store = transaction.objectStore(storeName)

        if (!query) {
          // Clear all data if no query is provided
          const request = store.clear()
          request.onerror = () => reject(new Error('Error clearing all data'))
          request.onsuccess = () => resolve()
        } else {
          // Clear data based on the query
          const index = indexName ? store.index(indexName) : store
          const request = index.openCursor(query)
          let deletedCount = 0

          request.onerror = () => reject(new Error('Error clearing data based on query'))
          request.onsuccess = (event) => {
            const cursor = event.target.result
            if (cursor) {
              const deleteRequest = cursor.delete()
              deleteRequest.onerror = () => reject(new Error('Error deleting item'))
              deleteRequest.onsuccess = () => {
                deletedCount++
                cursor.continue()
              }
            } else {
              resolve(deletedCount)
            }
          }
        }
      })
    })
  }, [queueOperation, storeName])

  const getByIndex = useCallback((indexName, key) => {
    return queueOperation((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly')
        const store = transaction.objectStore(storeName)
        const index = store.index(indexName)
        const request = index.get(key)

        request.onerror = () => reject(new Error('Error getting data by index'))
        request.onsuccess = () => resolve(request.result)
      })
    })
  }, [queueOperation, storeName])

  const getAllByIndex = useCallback((indexName, query, direction = 'next', limit = Infinity) => {
    return queueOperation((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly')
        const store = transaction.objectStore(storeName)
        const index = store.index(indexName)
        const request = index.openCursor(query, direction)
        const results = []

        request.onerror = () => reject(new Error('Error getting data by index'))
        request.onsuccess = (event) => {
          const cursor = event.target.result
          if (cursor && results.length < limit) {
            results.push(cursor.value)
            cursor.continue()
          } else {
            resolve(results)
          }
        }
      })
    })
  }, [queueOperation, storeName])

  const getPage = useCallback((page = 1, pageSize = 10, indexName = null, query = null, direction = 'next') => {
    return queueOperation((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly')
        const store = transaction.objectStore(storeName)
        const target = indexName ? store.index(indexName) : store
        const request = target.openCursor(query, direction)
        const results = []
        let skipped = 0
        let hasMore = false

        request.onerror = () => reject(new Error('Error getting page'))
        request.onsuccess = (event) => {
          const cursor = event.target.result
          if (cursor) {
            if (skipped < (page - 1) * pageSize) {
              skipped++
              cursor.continue()
            } else if (results.length < pageSize) {
              results.push(cursor.value)
              cursor.continue()
            } else {
              hasMore = true
            }
          }
          if (hasMore || !cursor) {
            const countRequest = target.count()
            countRequest.onsuccess = () => {
              resolve({
                data: results,
                total: countRequest.result,
                hasMore
              })
            }
            countRequest.onerror = () => reject(new Error('Error counting items'))
          }
        }
      })
    })
  }, [queueOperation, storeName])

  return { add, get, getAll, update, remove, clear, getByIndex, getAllByIndex, getPage, error, notSupported }
}

export default useIndexedDB
