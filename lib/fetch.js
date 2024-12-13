import { TimeoutError } from '@/lib/time'

class FetchTimeoutError extends TimeoutError {
  constructor (method, url, timeout) {
    super(timeout)
    this.name = 'FetchTimeoutError'
    this.message = `${method} ${url}: timeout after ${timeout / 1000}s`
  }
}

export async function fetchWithTimeout (resource, { timeout = 1000, ...options } = {}) {
  try {
    return await fetch(resource, {
      ...options,
      signal: AbortSignal.timeout(timeout)
    })
  } catch (err) {
    if (err.name === 'TimeoutError') {
      // use custom error message
      throw new FetchTimeoutError('GET', resource, timeout)
    }
    throw err
  }
}

class LRUCache {
  constructor (maxSize = 100) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get (key) {
    if (!this.cache.has(key)) return undefined
    const value = this.cache.get(key)
    // refresh the entry
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  delete (key) {
    this.cache.delete(key)
  }

  set (key, value) {
    if (this.cache.has(key)) this.cache.delete(key)
    else if (this.cache.size >= this.maxSize) {
      // Remove the least recently used item
      this.cache.delete(this.cache.keys().next().value)
    }
    this.cache.set(key, value)
  }
}

function createDebugLogger (name, cache, debug) {
  const noop = () => {}

  if (!debug) {
    return {
      log: noop,
      errorLog: noop,
      startPeriodicLogging: noop,
      stopPeriodicLogging: noop,
      incrementTotalFetches: noop,
      incrementCacheHits: noop,
      incrementCacheMisses: noop,
      incrementBackgroundRefreshes: noop
    }
  }

  let totalFetches = 0
  let cacheMisses = 0
  let cacheHits = 0
  let backgroundRefreshes = 0
  let intervalId = null

  const log = (message) => console.log(`[CACHE:${name}] ${message}`)
  const errorLog = (message, error) => console.error(`[CACHE:${name}] ${message}`, error)

  function estimateCacheSize () {
    let size = 0
    for (const [key, value] of cache.cache) {
      size += key.length * 2
      size += JSON.stringify(value).length * 2
    }
    return size
  }

  function startPeriodicLogging () {
    if (intervalId) return // Prevent multiple intervals
    intervalId = setInterval(() => {
      const cacheSize = cache.cache.size
      const memorySizeBytes = estimateCacheSize()
      log(`Stats: total=${totalFetches}, hits=${cacheHits}, misses=${cacheMisses}, backgroundRefreshes=${backgroundRefreshes}, cacheSize=${cacheSize}, memoryFootprint=${memorySizeBytes} bytes`)
    }, 60000)
  }

  function stopPeriodicLogging () {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  return {
    log,
    errorLog,
    startPeriodicLogging,
    stopPeriodicLogging,
    incrementTotalFetches: () => totalFetches++,
    incrementCacheHits: () => cacheHits++,
    incrementCacheMisses: () => cacheMisses++,
    incrementBackgroundRefreshes: () => backgroundRefreshes++
  }
}

export function cachedFetcher (fetcher, {
  maxSize = 100, cacheExpiry, forceRefreshThreshold,
  keyGenerator, debug = process.env.DEBUG_CACHED_FETCHER
}) {
  const cache = new LRUCache(maxSize)
  const name = fetcher.name || fetcher.toString().slice(0, 20).replace(/\s+/g, '_')
  const logger = createDebugLogger(name, cache, debug)

  logger.log(`initializing with maxSize=${maxSize}, cacheExpiry=${cacheExpiry}, forceRefreshThreshold=${forceRefreshThreshold}`)
  logger.startPeriodicLogging()

  if (!keyGenerator) {
    throw new Error('keyGenerator is required')
  }

  const cachedFetch = async function (...args) {
    const key = keyGenerator(...args)
    const now = Date.now()
    logger.incrementTotalFetches()

    async function fetchAndCache () {
      logger.log(`Fetching data for key: ${key}`)
      const result = await fetcher(...args)
      cache.set(key, { data: result, createdAt: now })
      logger.log(`Data fetched and cached for key: ${key}`)
      return result
    }

    const cached = cache.get(key)

    if (cached) {
      const age = now - cached.createdAt

      if (cacheExpiry === 0 || age < cacheExpiry) {
        logger.incrementCacheHits()
        logger.log(`Cache hit for key: ${key}, age: ${age}ms`)
        return cached.data
      } else if (forceRefreshThreshold === 0 || age < forceRefreshThreshold) {
        if (cached.pendingPromise) {
          logger.log(`Already background refreshing key: ${key}`)
          return cached.data
        }

        logger.incrementBackgroundRefreshes()
        logger.log(`Background refresh for key: ${key}, age: ${age}ms`)
        cached.pendingPromise = fetchAndCache().catch(error => {
          logger.errorLog(`Background refresh failed for key: ${key}`, error)
          return cached.data
        }).finally(() => {
          logger.log(`Background refresh completed for key: ${key}`)
          delete cached.pendingPromise
        })
        return cached.data
      }

      if (cached.pendingPromise) {
        logger.log(`Waiting for pending force refresh for key: ${key}`)
        return await cached.pendingPromise
      }
    }

    logger.incrementCacheMisses()
    logger.log(`Cache miss for key: ${key}`)
    const entry = { createdAt: now, pendingPromise: fetchAndCache() }
    try {
      entry.data = await entry.pendingPromise
      cache.set(key, entry)
      return entry.data
    } catch (error) {
      logger.errorLog(`Error fetching data for key: ${key}`, error)
      cache.delete(key)
      throw error
    } finally {
      logger.log(`Fetch completed for key: ${key}`)
      delete entry.pendingPromise
    }
  }

  // Attach the stopPeriodicLogging method to the returned function
  cachedFetch.stopPeriodicLogging = logger.stopPeriodicLogging

  return cachedFetch
}
