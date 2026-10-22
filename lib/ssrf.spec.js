/* eslint-env jest */
import dns from 'dns'
import { SsrfError, assertPublicAddress, assertPublicHost, ssrfSafeLookup } from './ssrf'
import { getAgent, HttpProxyAgent } from './proxy'
import { snFetch } from './fetch'
import crossFetch from 'cross-fetch'

// keep snFetch hermetic: never open a real socket. the SSRF decisions we care about
// (block before fetch / which agent + lookup gets attached) are all observable from
// whether/how crossFetch is invoked.
jest.mock('cross-fetch', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({ ok: true, status: 200, headers: new Map() }))
}))

const noAbort = new AbortController().signal

describe('ssrf guard', () => {
  afterEach(() => jest.restoreAllMocks())

  describe('assertPublicAddress', () => {
    // [address, expected ipaddr range] — a list (not an object) so alternate encodings
    // like 2130706433 / 0x7f000001 can't collide on a coerced string key
    const blocked = [
      ['127.0.0.1', 'loopback'],
      ['10.0.0.1', 'private'],
      ['172.16.0.1', 'private'],
      ['192.168.1.1', 'private'],
      ['169.254.169.254', 'linkLocal'], // cloud metadata endpoint
      ['0.0.0.0', 'unspecified'],
      ['100.64.0.1', 'carrierGradeNat'],
      ['255.255.255.255', 'broadcast'],
      ['224.0.0.1', 'multicast'],
      ['192.0.2.1', 'reserved'],
      ['2130706433', 'loopback'], // decimal-encoded 127.0.0.1
      ['0x7f.0.0.1', 'loopback'], // hex-encoded 127.0.0.1
      ['127.1', 'loopback'], // short-form 127.0.0.1
      ['::1', 'loopback'],
      ['::', 'unspecified'],
      ['fe80::1', 'linkLocal'],
      ['fc00::1', 'uniqueLocal'],
      ['ff02::1', 'multicast'],
      ['::ffff:127.0.0.1', 'loopback'], // ipv4-mapped ipv6 is unwrapped first
      ['64:ff9b::a00:1', 'rfc6052'], // NAT64-embedded 10.0.0.1
      ['2002:7f00:101::', '6to4'],
      ['2001:db8::1', 'reserved']
    ]

    test('blocks everything that is not globally routable unicast', () => {
      for (const [address, range] of blocked) {
        let err
        try { assertPublicAddress(address) } catch (e) { err = e }
        expect(err).toBeInstanceOf(SsrfError)
        expect(err.address).toBe(address)
        expect(err.range).toBe(range)
        expect(err.message).not.toContain(address) // generic message, no internals reflected
      }
    })

    test('allows public unicast addresses', () => {
      for (const address of ['8.8.8.8', '1.1.1.1', '104.16.0.1', '2606:4700::1111', '2600:1f18::1']) {
        expect(() => assertPublicAddress(address)).not.toThrow()
      }
    })

    test('rejects unparseable input', () => {
      expect(() => assertPublicAddress('not-an-ip')).toThrow(SsrfError)
    })
  })

  describe('assertPublicHost', () => {
    test('validates IP-literal hosts, including bracketed IPv6 and unnormalized encodings', () => {
      expect(() => assertPublicHost('169.254.169.254')).toThrow(SsrfError)
      expect(() => assertPublicHost('[::1]')).toThrow(SsrfError)
      expect(() => assertPublicHost('::1')).toThrow(SsrfError)
      expect(() => assertPublicHost('2130706433')).toThrow(SsrfError)
      expect(() => assertPublicHost('8.8.8.8')).not.toThrow()
    })

    test('passes DNS hostnames through untouched (they are judged at lookup time)', () => {
      expect(() => assertPublicHost('stacker.news')).not.toThrow()
      expect(() => assertPublicHost('localhost')).not.toThrow()
    })
  })

  describe('ssrfSafeLookup', () => {
    const mockDns = addresses =>
      jest.spyOn(dns, 'lookup').mockImplementation((hostname, options, cb) => cb(null, addresses))
    const lookup = (hostname, options) => new Promise((resolve, reject) => {
      ssrfSafeLookup(hostname, options, (err, ...result) => err ? reject(err) : resolve(result))
    })

    test('resolves public hostnames in (address, family) shape', async () => {
      mockDns([{ address: '8.8.8.8', family: 4 }])
      await expect(lookup('good.example', {})).resolves.toEqual(['8.8.8.8', 4])
    })

    test('returns the full address list when the socket asks for all (happy eyeballs)', async () => {
      const addresses = [{ address: '2606:4700::1111', family: 6 }, { address: '1.1.1.1', family: 4 }]
      mockDns(addresses)
      await expect(lookup('good.example', { all: true })).resolves.toEqual([addresses])
    })

    test('always resolves all addresses upstream, preserving socket dns options', async () => {
      const spy = mockDns([{ address: '8.8.8.8', family: 4 }])
      await lookup('good.example', { family: 4, hints: dns.ADDRCONFIG })
      expect(spy).toHaveBeenCalledWith(
        'good.example',
        expect.objectContaining({ all: true, verbatim: true, family: 4, hints: dns.ADDRCONFIG }),
        expect.any(Function)
      )
    })

    test('rejects hostnames resolving to a private address', async () => {
      mockDns([{ address: '10.0.0.1', family: 4 }])
      await expect(lookup('evil.example', {})).rejects.toBeInstanceOf(SsrfError)
    })

    test('rejects when a private address hides among public ones (rebinding)', async () => {
      mockDns([{ address: '8.8.8.8', family: 4 }, { address: '192.168.1.1', family: 4 }])
      await expect(lookup('rebind.example', { all: true })).rejects.toBeInstanceOf(SsrfError)
    })

    test('passes real dns errors through unchanged', async () => {
      jest.spyOn(dns, 'lookup').mockImplementation((hostname, options, cb) => {
        const err = new Error(`getaddrinfo ENOTFOUND ${hostname}`)
        err.code = 'ENOTFOUND'
        cb(err)
      })
      await expect(lookup('missing.example', {})).rejects.toMatchObject({ code: 'ENOTFOUND' })
    })

    test('treats an empty result as ENOTFOUND', async () => {
      mockDns([])
      await expect(lookup('empty.example', {})).rejects.toMatchObject({ code: 'ENOTFOUND' })
    })

    test('supports the (hostname, callback) form', async () => {
      mockDns([{ address: '10.0.0.1', family: 4 }])
      await expect(new Promise((resolve, reject) => {
        ssrfSafeLookup('evil.example', (err, address) => err ? reject(err) : resolve(address))
      })).rejects.toBeInstanceOf(SsrfError)
    })
  })

  describe('getAgent lookup threading', () => {
    test('threads lookup into clearnet agents', () => {
      expect(getAgent({ hostname: 'stacker.news', protocol: 'http:', lookup: ssrfSafeLookup }).options.lookup).toBe(ssrfSafeLookup)
      expect(getAgent({ hostname: 'stacker.news', protocol: 'https:', lookup: ssrfSafeLookup }).options.lookup).toBe(ssrfSafeLookup)
      expect(getAgent({ hostname: 'stacker.news', protocol: 'https:' }).options.lookup).toBeUndefined()
    })

    test('keeps custom CA cert alongside lookup', () => {
      const cert = Buffer.from('pem').toString('base64')
      const { options } = getAgent({ hostname: 'stacker.news', protocol: 'https:', cert, lookup: ssrfSafeLookup })
      expect(options.ca).toEqual(Buffer.from('pem'))
      expect(options.lookup).toBe(ssrfSafeLookup)
    })

    test('leaves the Tor proxy path untouched', () => {
      const prev = process.env.TOR_PROXY
      process.env.TOR_PROXY = 'http://127.0.0.1:7050'
      try {
        const agent = getAgent({ hostname: 'example.onion', protocol: 'http:', lookup: ssrfSafeLookup })
        expect(agent).toBeInstanceOf(HttpProxyAgent)
        expect(agent.options.lookup).toBeUndefined()
      } finally {
        if (prev === undefined) delete process.env.TOR_PROXY
        else process.env.TOR_PROXY = prev
      }
    })
  })

  describe('snFetch SSRF enforcement', () => {
    // run fn with NODE_ENV set to value (undefined deletes it), then restore
    const withEnv = async (value, fn) => {
      const prev = process.env.NODE_ENV
      if (value === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = value
      try { return await fn() } finally { process.env.NODE_ENV = prev }
    }
    // the per-hop agent factory snFetch handed node-fetch on its first call
    const agentFactory = () => crossFetch.mock.calls[0][1].agent

    beforeEach(() => {
      crossFetch.mockClear()
      jest.spyOn(dns, 'lookup') // tripwire: nothing here should hit real DNS
    })

    test('blocks a private IP literal before fetching (production)', async () => {
      await withEnv('production', () =>
        expect(snFetch('http://169.254.169.254', { signal: noAbort })).rejects.toBeInstanceOf(SsrfError)
      )
      expect(crossFetch).not.toHaveBeenCalled()
      expect(dns.lookup).not.toHaveBeenCalled()
    })

    test('enforces (fail-closed) when NODE_ENV is unset, staging, or test', async () => {
      for (const env of [undefined, 'staging', 'test']) {
        crossFetch.mockClear()
        await withEnv(env, () =>
          expect(snFetch('http://10.0.0.1', { signal: noAbort })).rejects.toBeInstanceOf(SsrfError)
        )
        expect(crossFetch).not.toHaveBeenCalled()
      }
    })

    test('allows private addresses in development', async () => {
      await withEnv('development', () =>
        expect(snFetch('http://127.0.0.1:1', { signal: noAbort })).resolves.toMatchObject({ ok: true })
      )
      expect(crossFetch).toHaveBeenCalledTimes(1)
    })

    test('allowPrivate bypasses the guard even when enforced', async () => {
      await withEnv('production', () =>
        expect(snFetch('http://127.0.0.1:1', { allowPrivate: true, signal: noAbort })).resolves.toMatchObject({ ok: true })
      )
      expect(crossFetch).toHaveBeenCalledTimes(1)
    })

    test('attaches the validating lookup to the agent for clearnet hosts when enforced', async () => {
      await withEnv('production', () => snFetch('https://example.com', { signal: noAbort }))
      const agent = agentFactory()({ hostname: 'example.com', protocol: 'https:' })
      expect(agent.options.lookup).toBe(ssrfSafeLookup)
    })

    test('does not attach the lookup in development', async () => {
      await withEnv('development', () => snFetch('https://example.com', { signal: noAbort }))
      const agent = agentFactory()({ hostname: 'example.com', protocol: 'https:' })
      expect(agent.options.lookup).toBeUndefined()
    })

    test('refuses an https→http downgrade redirect hop, but allows onion and same-protocol hops', async () => {
      await withEnv('production', () => snFetch('https://example.com', { signal: noAbort }))
      const factory = agentFactory()
      expect(() => factory({ hostname: 'evil.example', protocol: 'http:' })).toThrow(/downgrade/)
      expect(() => factory({ hostname: 'example.com', protocol: 'https:' })).not.toThrow()
      // onion hops legitimately use http (routed via the Tor proxy), so the guard skips them
      expect(() => factory({ hostname: 'foo.onion', protocol: 'http:' })).not.toThrow()
    })

    test('still attaches the guarding agent when the caller passes agent: false under enforcement', async () => {
      await withEnv('production', () => snFetch('https://example.com', { agent: false, signal: noAbort }))
      expect(typeof crossFetch.mock.calls[0][1].agent).toBe('function')
    })

    test('honors agent: false in development (no agent attached)', async () => {
      await withEnv('development', () => snFetch('https://example.com', { agent: false, signal: noAbort }))
      expect(crossFetch.mock.calls[0][1].agent).toBeUndefined()
    })
  })
})
