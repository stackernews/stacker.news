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

export function cachedFetcher (fetcher, { maxSize = 100, cacheExpiry, forceRefreshThreshold }) {
  const cache = new LRUCache(maxSize)

  return async function cachedFetch (...args) {
    const key = JSON.stringify(args)
    const now = Date.now()

    async function fetchAndCache () {
      const result = await fetcher(...args)
      cache.set(key, { data: result, createdAt: now })
      return result
    }

    const cached = cache.get(key)

    if (cached) {
      const age = now - cached.createdAt

      if (cacheExpiry === 0 || age < cacheExpiry) {
        return cached.data
      } else if (forceRefreshThreshold === 0 || age < forceRefreshThreshold) {
        fetchAndCache().catch(console.error)
        return cached.data
      }
    } else if (forceRefreshThreshold === 0) {
      fetchAndCache().catch(console.error)
      return null
    }

    return await fetchAndCache()
  }
}
