import { describe, test, afterEach, mock } from 'node:test'
import { expect } from 'expect'

const crossFetch = mock.fn(() => Promise.resolve({ ok: true, status: 200, headers: new Map() }))
mock.module('cross-fetch', { defaultExport: crossFetch })
const { cachedFetcher } = await import('./fetch')

function createDeferred () {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('cachedFetcher', () => {
  afterEach(() => mock.restoreAll())

  test('deduplicates concurrent cold requests for the same key', async () => {
    const deferred = createDeferred()
    const fetcher = mock.fn(() => deferred.promise)
    const wrapped = cachedFetcher(fetcher, {
      cacheExpiry: 100,
      forceRefreshThreshold: 200,
      keyGenerator: key => key
    })

    const calls = Array.from({ length: 10 }, () => wrapped('btc'))
    expect(fetcher.mock.callCount()).toBe(1)

    deferred.resolve(100000)
    const results = await Promise.all(calls)
    expect(results).toEqual(Array(10).fill(100000))
    expect(fetcher.mock.callCount()).toBe(1)
  })

  test('caches undefined results without re-fetching within cacheExpiry', async () => {
    const fetcher = mock.fn(async () => undefined)
    const wrapped = cachedFetcher(fetcher, {
      cacheExpiry: 100,
      forceRefreshThreshold: 200,
      keyGenerator: key => key
    })

    expect(await wrapped('missing')).toBeUndefined()
    expect(await wrapped('missing')).toBeUndefined()
    expect(fetcher.mock.callCount()).toBe(1)
  })

  test('keeps concurrent requests for distinct keys independent', async () => {
    const d1 = createDeferred()
    const d2 = createDeferred()
    const fetcher = mock.fn(key => (key === 'a' ? d1.promise : d2.promise))
    const wrapped = cachedFetcher(fetcher, {
      cacheExpiry: 100,
      forceRefreshThreshold: 200,
      keyGenerator: key => key
    })

    const pA1 = wrapped('a')
    const pA2 = wrapped('a')
    const pB1 = wrapped('b')
    expect(fetcher.mock.callCount()).toBe(2)

    d2.resolve('val-b')
    expect(await pB1).toBe('val-b')

    d1.resolve('val-a')
    expect(await Promise.all([pA1, pA2])).toEqual(['val-a', 'val-a'])
  })

  test('propagates shared rejection to concurrent callers and allows subsequent retry', async () => {
    const d1 = createDeferred()
    let attempt = 0
    const fetcher = mock.fn(() => {
      attempt++
      if (attempt === 1) return d1.promise
      return Promise.resolve('recovered')
    })
    const wrapped = cachedFetcher(fetcher, {
      cacheExpiry: 100,
      forceRefreshThreshold: 200,
      keyGenerator: key => key
    })

    const c1 = wrapped('key')
    const c2 = wrapped('key')
    expect(fetcher.mock.callCount()).toBe(1)

    d1.reject(new Error('network failure'))
    await expect(c1).rejects.toThrow(/network failure/)
    await expect(c2).rejects.toThrow(/network failure/)

    expect(await wrapped('key')).toBe('recovered')
    expect(fetcher.mock.callCount()).toBe(2)
  })

  test('deduplicates concurrent foreground refreshes after forceRefreshThreshold', async () => {
    let now = 1000
    mock.method(Date, 'now', () => now)

    const dRefresh = createDeferred()
    let call = 0
    const fetcher = mock.fn(() => {
      call++
      if (call === 1) return Promise.resolve('initial')
      return dRefresh.promise
    })

    const wrapped = cachedFetcher(fetcher, {
      cacheExpiry: 100,
      forceRefreshThreshold: 200,
      keyGenerator: key => key
    })

    expect(await wrapped('k')).toBe('initial')
    expect(fetcher.mock.callCount()).toBe(1)

    now = 1250
    const r1 = wrapped('k')
    const r2 = wrapped('k')
    const r3 = wrapped('k')
    expect(fetcher.mock.callCount()).toBe(2)

    dRefresh.resolve('refreshed')
    expect(await Promise.all([r1, r2, r3])).toEqual(['refreshed', 'refreshed', 'refreshed'])
    expect(fetcher.mock.callCount()).toBe(2)
  })

  test('serves stale data during background refresh without duplicating refresh requests', async () => {
    let now = 1000
    mock.method(Date, 'now', () => now)

    const dBg = createDeferred()
    let call = 0
    const fetcher = mock.fn(() => {
      call++
      if (call === 1) return Promise.resolve('v1')
      return dBg.promise
    })

    const wrapped = cachedFetcher(fetcher, {
      cacheExpiry: 100,
      forceRefreshThreshold: 200,
      keyGenerator: key => key
    })

    expect(await wrapped('k')).toBe('v1')
    expect(fetcher.mock.callCount()).toBe(1)

    now = 1150
    expect(await wrapped('k')).toBe('v1')
    expect(await wrapped('k')).toBe('v1')
    expect(fetcher.mock.callCount()).toBe(2)

    now = 1160
    dBg.resolve('v2')
    await dBg.promise
    await new Promise(resolve => setImmediate(resolve))

    expect(await wrapped('k')).toBe('v2')
    expect(fetcher.mock.callCount()).toBe(2)
  })
})
