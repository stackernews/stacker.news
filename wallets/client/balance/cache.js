import { withTimeoutSignal } from '@/lib/time'
import { stableObjectHash } from '@/wallets/lib/config'

const TTL_MS = 30_000
const READ_TIMEOUT_MS = 10_000

// One cached balance per (protocol id + config hash). Each entry is in one of
// two shapes, and a failed read drops the entry entirely:
//   - in flight: { promise }           — a read is running; new readers await it
//   - settled:   { result, fetchedAt } — last good result and when we fetched it
// `result` is { balance }, where balance is { amount, currency } or null.
const cache = new Map()

// Hash the config so plaintext credentials never appear in cache keys.
function cacheKey (protocol) {
  return `${protocol.id}:${stableObjectHash(protocol.config)}`
}

// The settled result for `key` while it's within the TTL, else undefined
// (missing, still in flight, or expired).
function freshResult (key) {
  const entry = cache.get(key)
  if (!entry?.fetchedAt) return undefined
  if (Date.now() - entry.fetchedAt > TTL_MS) return undefined
  return entry.result
}

// Synchronous read of the cached balance; never starts a fetch.
export function peekCachedWalletBalance (protocol) {
  return protocol ? freshResult(cacheKey(protocol)) : undefined
}

// Return a fresh cached balance, join an in-flight read, or start a new one.
export async function readCachedWalletBalance (protocol, { signal } = {}) {
  const key = cacheKey(protocol)

  const fresh = freshResult(key)
  if (fresh !== undefined) return fresh

  const inFlight = cache.get(key)?.promise
  if (inFlight) return await inFlight

  // One timeout mechanism only: the abort signal. Adapters that honor it fail
  // fast as TimeoutError instead of racing a separate timeout promise against
  // the abort (which used to leave the UI stuck on `loading`).
  const entry = {}
  entry.promise = (async () => {
    try {
      const balance = signal
        ? await protocol.getBalance(protocol.config, { signal })
        : await withTimeoutSignal(READ_TIMEOUT_MS, s => protocol.getBalance(protocol.config, { signal: s }))
      const result = { balance: balance ?? null }
      // Identity guard: an invalidate/clear or newer read may have replaced this
      // entry while we awaited, so only write back if it's still ours.
      if (cache.get(key) === entry) cache.set(key, { result, fetchedAt: Date.now() })
      return result
    } catch (err) {
      if (cache.get(key) === entry) cache.delete(key)
      throw err
    }
  })()
  cache.set(key, entry)
  return await entry.promise
}

// Drop every cached config for this protocol id (e.g. after a send).
export function invalidateWalletBalanceCache (protocol) {
  if (!protocol) return

  const prefix = `${protocol.id}:`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

export function clearWalletBalanceCache () {
  cache.clear()
}
