import { describe, test, afterEach, mock } from 'node:test'
import { expect } from 'expect'

const mockMappings = {
  'news.pizza.com': {
    id: 42,
    domainName: 'news.pizza.com',
    subName: 'pizza',
    subDesc: 'Pizza lovers',
    subBranding: { primaryColor: '#ff0000' },
    tokenVersion: 7
  }
}

mock.module('@/lib/domains', {
  namedExports: {
    domainsMappingsCache: mock.fn(async () => mockMappings),
    getDomainMapping: mock.fn(async (host) => mockMappings[host?.toLowerCase()] ?? null)
  }
})

const { default: handler } = await import('./domains.js')

function createMockRes () {
  const headers = {}
  let statusCode = 200
  let jsonBody = null
  return {
    headers,
    get statusCode () { return statusCode },
    get jsonBody () { return jsonBody },
    setHeader (k, v) { headers[k] = v },
    status (code) {
      statusCode = code
      return this
    },
    json (payload) {
      jsonBody = payload
      return this
    }
  }
}

describe('/api/domains endpoint', () => {
  afterEach(() => mock.restoreAll())

  test('rejects non-GET methods with 405', async () => {
    const res = createMockRes()
    await handler({ method: 'POST', query: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  test('returns sanitized public domain mapping without leaking id or tokenVersion', async () => {
    const res = createMockRes()
    await handler({ method: 'GET', query: { domain: 'news.pizza.com' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.jsonBody).toEqual({
      domainName: 'news.pizza.com',
      subName: 'pizza'
    })
    expect(res.jsonBody.id).toBeUndefined()
    expect(res.jsonBody.tokenVersion).toBeUndefined()
  })

  test('returns 404 for unknown or unsafe domains', async () => {
    for (const bad of ['unknown.example.com', 'evil.com/path', '']) {
      const res = createMockRes()
      await handler({ method: 'GET', query: { domain: bad } }, res)
      expect(res.statusCode).toBe(404)
    }
  })

  test('lists all active domains with only public fields when no domain query is provided', async () => {
    const res = createMockRes()
    await handler({ method: 'GET', query: {} }, res)
    expect(res.statusCode).toBe(200)
    expect(res.jsonBody).toEqual({
      domains: [{ domainName: 'news.pizza.com', subName: 'pizza' }]
    })
  })
})
