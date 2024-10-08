export async function fetchWithTimeout (resource, { timeout = 1000, ...options } = {}) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  const response = await fetch(resource, {
    ...options,
    signal: controller.signal
  })
  clearTimeout(id)

  return response
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

  set (key, value) {
    if (this.cache.has(key)) this.cache.delete(key)
    else if (this.cache.size >= this.maxSize) {
      // Remove the least recently used item
      this.cache.delete(this.cache.keys().next().value)
    }
    this.cache.set(key, value)
  }
}

export function cachedFetcher (fetcher, { maxSize = 100, cacheExpiry, forceRefreshThreshold, keyGenerator }) {
  const cache = new LRUCache(maxSize)
  console.log(`[CACHE] Initializing cache: maxSize=${maxSize}, cacheExpiry=${cacheExpiry}, forceRefreshThreshold=${forceRefreshThreshold}`)

  if (!keyGenerator) {
    throw new Error('keyGenerator is required')
  }

  let totalFetches = 0
  let cacheMisses = 0
  let cacheHits = 0
  let backgroundRefreshes = 0

  setInterval(() => {
    console.log(`[CACHE] Stats: total=${totalFetches}, hits=${cacheHits}, misses=${cacheMisses}, backgroundRefreshes=${backgroundRefreshes}, cacheSize=${cache.cache.size}`)
  }, 60000) // Log stats every minute

  return async function cachedFetch (...args) {
    const key = keyGenerator(...args)
    const now = Date.now()
    totalFetches++

    async function fetchAndCache () {
      console.log(`[CACHE] Fetching data for key: ${key}`)
      const result = await fetcher(...args)
      cache.set(key, { data: result, createdAt: now })
      console.log(`[CACHE] Data fetched and cached for key: ${key}`)
      return result
    }

    const cached = cache.get(key)

    if (cached) {
      if (cached.pendingPromise) {
        console.log(`[CACHE] Waiting for pending promise for key: ${key}`)
        return await cached.pendingPromise
      }

      const age = now - cached.createdAt

      if (cacheExpiry === 0 || age < cacheExpiry) {
        cacheHits++
        console.log(`[CACHE] Cache hit for key: ${key}, age: ${age}ms`)
        return cached.data
      } else if (forceRefreshThreshold === 0 || age < forceRefreshThreshold) {
        backgroundRefreshes++
        console.log(`[CACHE] Background refresh for key: ${key}, age: ${age}ms`)
        cached.pendingPromise = fetchAndCache()
        cached.pendingPromise.finally(() => {
          console.log(`[CACHE] Background refresh completed for key: ${key}`)
          delete cached.pendingPromise
        })
        return cached.data
      }
    }

    cacheMisses++
    console.log(`[CACHE] Cache miss for key: ${key}`)
    const entry = { createdAt: now, pendingPromise: fetchAndCache() }
    cache.set(key, entry)
    try {
      entry.data = await entry.pendingPromise
      return entry.data
    } catch (error) {
      console.error(`[CACHE] Error fetching data for key: ${key}`, error)
      cache.delete(key)
      throw error
    } finally {
      console.log(`[CACHE] Fetch completed for key: ${key}`)
      delete entry.pendingPromise
    }
  }
}
