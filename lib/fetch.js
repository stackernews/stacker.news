import { TimeoutError, timeoutSignal } from '@/lib/time'
import crossFetch from 'cross-fetch'
import { getAgent } from '@/lib/proxy'
import { TOR_REGEXP } from '@/lib/url'
import { assertPublicHost, ssrfEnforced, ssrfSafeLookup } from '@/lib/ssrf'

export class FetchTimeoutError extends TimeoutError {
  constructor (method, url, timeout) {
    super(timeout)
    this.name = 'FetchTimeoutError'
    this.message = timeout
      ? `${method} ${url}: timeout after ${timeout / 1000}s`
      : `${method} ${url}: timeout`
  }
}

/**
 * Adds user-agent header (server-side only).
 * @param {Headers|HeadersInit} [headers] - existing headers to augment
 * @returns {Headers} - headers with user-agent set
 */
function snUserAgent (headers) {
  const h = new Headers(headers || undefined)
  if (!h.has('user-agent')) {
    const isProd = process.env.NODE_ENV === 'production'
    const commitHash = isProd ? process.env.NEXT_PUBLIC_COMMIT_HASH : 'dev'
    h.set('user-agent', `StackerNews/${commitHash} (+https://stacker.news; ops@stacker.news)`)
  }
  return h
}

/**
 * Isomorphic fetch with timeout, user-agent (server), and Tor proxy (server).
 *
 * @param {string|URL} url - URL to fetch (or base URL if path provided)
 * @param {Object} [options]
 * @param {string} [options.path] - path to append to base URL (joined properly)
 * @param {string} [options.protocol='https'] - default protocol if none provided ('http' or 'https')
 * @param {number} [options.timeout=10000] - timeout in ms (default 10 seconds)
 * @param {string} [options.cert] - base64 CA cert for custom HTTPS (server only)
 * @param {boolean} [options.agent=true] - set to false to skip agent (server only; ignored while the SSRF guard is active)
 * @param {boolean} [options.allowPrivate=false] - allow requests to private/internal addresses (server only)
 * @param {AbortSignal} [options.signal] - abort signal (overrides timeout)
 */
export async function snFetch (url, { path, protocol = 'https', timeout = 10000, cert, agent = true, allowPrivate = false, signal, ...options } = {}) {
  const isServer = typeof window === 'undefined'

  // normalize URL: ensure protocol exists
  let urlStr = url.toString()
  if (!urlStr.includes('://')) urlStr = `${protocol}://${urlStr}`

  // join path by directly manipulating pathname
  // (URL constructor treats '/path' as absolute from origin, losing any base path)
  const urlObj = new URL(urlStr)
  if (path) {
    const basePath = urlObj.pathname.replace(/\/+$/, '')
    urlObj.pathname = basePath + (path.startsWith('/') ? path : '/' + path)
  }

  // Server-only: normalize protocol for onion addresses (use HTTP unless cert provided)
  if (isServer && TOR_REGEXP.test(urlObj.hostname) && !cert && urlObj.protocol === 'https:') {
    urlObj.protocol = 'http:'
  }

  // Server-only: refuse requests to private/internal addresses (SSRF). development is
  // exempt (see ssrfEnforced) so localhost/docker wallets keep working; allowPrivate is a
  // per-call escape hatch.
  const enforceSsrf = isServer && !allowPrivate && ssrfEnforced()
  if (enforceSsrf) assertPublicHost(urlObj.hostname)
  const originalProtocol = urlObj.protocol

  // Server-only: get proxy agent for Tor and custom certs. a function so node-fetch
  // rebuilds the agent for every redirect hop: each hop is then SSRF-checked too —
  // hostnames via the agent's validating dns lookup, raw IP literals (which never hit
  // the lookup) directly — and gets an agent matching its own protocol. When the guard
  // is active we attach it even if the caller passed agent: false.
  const fetchAgent = isServer && (agent !== false || enforceSsrf)
    ? ({ hostname, protocol: hopProtocol }) => {
        const isOnion = TOR_REGEXP.test(hostname)
        // never follow an https→http downgrade to a clearnet host: request headers
        // (e.g. wallet API keys) and the response would otherwise travel in cleartext
        if (!isOnion && originalProtocol === 'https:' && hopProtocol === 'http:') {
          throw new Error('refusing to follow a redirect that downgrades https to http')
        }
        // .onion hostnames resolve via the Tor proxy, never locally
        const guard = enforceSsrf && !isOnion
        if (guard) assertPublicHost(hostname)
        return getAgent({ hostname, cert, protocol: hopProtocol, lookup: guard ? ssrfSafeLookup : undefined })
      }
    : undefined

  // Server-only: add user-agent header
  const headers = isServer ? snUserAgent(options.headers) : options.headers

  // only create timeout signal if no signal provided
  const useTimeoutSignal = !signal
  const fetchSignal = signal ?? timeoutSignal(timeout)

  try {
    return await crossFetch(urlObj.toString(), {
      // Cap response body bytes via res.text()/json()/blob() (node-fetch server-side; browsers
      // ignore it). Override per-call with size: 0 (unlimited) or a larger cap.
      size: 256 * 1024,
      // cap redirect hops below node-fetch's default of 20 (server-side; browsers ignore it)
      follow: 5,
      ...options,
      headers,
      ...(fetchAgent && { agent: fetchAgent }),
      signal: fetchSignal
    })
  } catch (err) {
    // only convert to FetchTimeoutError if we created the timeout signal
    if (err.name === 'AbortError' && useTimeoutSignal) {
      throw new FetchTimeoutError(options.method ?? 'GET', urlObj, timeout)
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
