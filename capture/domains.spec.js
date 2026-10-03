/* eslint-env jest */
import { jest } from '@jest/globals'
import { createDomainsAllowlist } from './domains.js'

const ENDPOINT = 'http://app:3000/api/capture/domains'
const SECRET = 'shhh'
const TTL = 1000
const STALE_TTL = 5000

const ok = (domains) => ({
  ok: true,
  status: 200,
  json: async () => ({ domains })
})

// lets a background refresh settle without leaning on timers
const flush = () => new Promise(resolve => setImmediate(resolve))

function setup (options = {}) {
  const { responses = [ok(['pizza.com'])] } = options
  // an unset env var arrives as undefined, so a destructuring default would mask it
  const secret = 'secret' in options ? options.secret : SECRET
  let clock = 0
  const fetchImpl = jest.fn(async () => {
    const next = responses.shift()
    if (next instanceof Error) throw next
    return next
  })
  const logger = { error: jest.fn() }
  const allowlist = createDomainsAllowlist({
    endpoint: ENDPOINT,
    secret,
    ttl: TTL,
    staleTtl: STALE_TTL,
    fetchImpl,
    now: () => clock,
    logger
  })
  return { allowlist, fetchImpl, logger, advance: ms => { clock += ms } }
}

describe('createDomainsAllowlist', () => {
  describe('fetching', () => {
    test('calls the endpoint with the shared secret', async () => {
      const { allowlist, fetchImpl } = setup()

      await allowlist.get()

      expect(fetchImpl).toHaveBeenCalledTimes(1)
      const [url, options] = fetchImpl.mock.calls[0]
      expect(url).toBe(ENDPOINT)
      expect(options.headers.Authorization).toBe(`Bearer ${SECRET}`)
    })

    test('returns the domains as a set', async () => {
      const { allowlist } = setup({ responses: [ok(['pizza.com', 'www.foo.sndev'])] })

      const domains = await allowlist.get()

      expect(domains).toEqual(new Set(['pizza.com', 'www.foo.sndev']))
    })

    test('normalizes domains to lowercase', async () => {
      const { allowlist } = setup({ responses: [ok(['PIZZA.com'])] })

      expect(await allowlist.get()).toEqual(new Set(['pizza.com']))
    })

    test('an empty allowlist is not the same as an unavailable one', async () => {
      const { allowlist } = setup({ responses: [ok([])] })

      expect(await allowlist.get()).toEqual(new Set())
    })

    test('concurrent cold reads share one fetch', async () => {
      const { allowlist, fetchImpl } = setup()

      await Promise.all([allowlist.get(), allowlist.get(), allowlist.get()])

      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    // capture answers 503 on a null allowlist, so a misconfigured deploy degrades to
    // "custom domains unavailable" instead of taking main-domain captures down with it
    test('without a secret it never calls the endpoint', async () => {
      const { allowlist, fetchImpl } = setup({ secret: undefined })

      expect(await allowlist.get()).toBeNull()
      expect(fetchImpl).not.toHaveBeenCalled()
    })
  })

  describe('caching', () => {
    test('serves the cached value inside the ttl', async () => {
      const { allowlist, fetchImpl, advance } = setup({ responses: [ok(['pizza.com'])] })
      await allowlist.get()

      advance(TTL - 1)

      expect(await allowlist.get()).toEqual(new Set(['pizza.com']))
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    test('past the ttl it serves the stale value and refreshes in the background', async () => {
      const { allowlist, fetchImpl, advance } = setup({
        responses: [ok(['pizza.com']), ok(['sushi.com'])]
      })
      await allowlist.get()

      advance(TTL)

      // the stale value comes back immediately, the new one only after the refresh lands
      expect(await allowlist.get()).toEqual(new Set(['pizza.com']))
      await flush()
      expect(fetchImpl).toHaveBeenCalledTimes(2)
      expect(await allowlist.get()).toEqual(new Set(['sushi.com']))
    })

    test('only one background refresh runs at a time', async () => {
      const { allowlist, fetchImpl, advance } = setup({
        responses: [ok(['pizza.com']), ok(['sushi.com'])]
      })
      await allowlist.get()

      advance(TTL)
      await Promise.all([allowlist.get(), allowlist.get(), allowlist.get()])
      await flush()

      expect(fetchImpl).toHaveBeenCalledTimes(2)
    })

    test('a failed background refresh keeps serving the stale value', async () => {
      const { allowlist, advance } = setup({
        responses: [ok(['pizza.com']), new Error('app is down')]
      })
      await allowlist.get()

      advance(TTL)
      expect(await allowlist.get()).toEqual(new Set(['pizza.com']))
      await flush()

      expect(await allowlist.get()).toEqual(new Set(['pizza.com']))
    })

    // staleness is bounded: past staleTtl a revoked domain must not stay capturable
    test('past the stale ttl it waits for a fresh value', async () => {
      const { allowlist, advance } = setup({
        responses: [ok(['pizza.com']), ok(['sushi.com'])]
      })
      await allowlist.get()

      advance(STALE_TTL)

      expect(await allowlist.get()).toEqual(new Set(['sushi.com']))
    })

    test('past the stale ttl a failed fetch drops the allowlist', async () => {
      const { allowlist, advance } = setup({
        responses: [ok(['pizza.com']), new Error('app is down')]
      })
      await allowlist.get()

      advance(STALE_TTL)

      expect(await allowlist.get()).toBeNull()
    })

    test('recovers once the endpoint comes back', async () => {
      const { allowlist, advance } = setup({
        responses: [new Error('app is down'), ok(['pizza.com'])]
      })
      expect(await allowlist.get()).toBeNull()

      expect(await allowlist.get()).toEqual(new Set(['pizza.com']))
      advance(TTL - 1)
      expect(await allowlist.get()).toEqual(new Set(['pizza.com']))
    })
  })

  describe('bad responses', () => {
    test('a transport error yields null and is logged', async () => {
      const { allowlist, logger } = setup({ responses: [new Error('ECONNREFUSED')] })

      expect(await allowlist.get()).toBeNull()
      expect(logger.error).toHaveBeenCalled()
    })

    test.each([401, 404, 500])('a %i response yields null', async status => {
      const { allowlist } = setup({ responses: [{ ok: false, status, json: async () => ({}) }] })

      expect(await allowlist.get()).toBeNull()
    })

    test.each([
      ['a non-object body', 'nope'],
      ['a missing domains key', {}],
      ['domains that are not an array', { domains: 'pizza.com' }],
      ['a non-string entry', { domains: ['pizza.com', 42] }],
      ['an empty entry', { domains: ['pizza.com', ''] }]
    ])('%s yields null', async (_label, body) => {
      const { allowlist } = setup({ responses: [{ ok: true, status: 200, json: async () => body }] })

      expect(await allowlist.get()).toBeNull()
    })

    test('unparseable json yields null', async () => {
      const { allowlist } = setup({
        responses: [{ ok: true, status: 200, json: async () => { throw new Error('bad json') } }]
      })

      expect(await allowlist.get()).toBeNull()
    })
  })
})
