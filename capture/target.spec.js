/* eslint-env jest */
import { isAssetPath, resolveCaptureTarget } from './target.js'

const baseUrl = new URL('https://stacker.news/')
const allowed = new Set(['pizza.com', 'www.foo.sndev'])

// resolveCaptureTarget is the whole security boundary of the multi-origin capture:
// everything it returns a url for is a page we're about to open in a headless
// browser running on SN's infra, so the negative cases matter as much as the happy ones.
//
// URL instances carry no own enumerable properties, so toEqual() on them compares
// vacuously (any two URLs match). Flatten to href before asserting.
const resolve = (originalUrl, { allowedDomains = allowed, ...rest } = {}) => {
  const result = resolveCaptureTarget({ originalUrl, baseUrl, allowedDomains, ...rest })
  return result.url ? { href: result.url.href, domain: result.domain } : result
}

describe('isAssetPath', () => {
  const assets = [
    '/_next/static/chunk.js',
    '/icons/icon_x192.png',
    '/sw.js',
    '/robots.txt',
    '/manifest.json',
    '/site.webmanifest',
    '/api/site.webmanifest',
    '/favicon.ico',
    '/favicon-32x32.png',
    '/apple-touch-icon.png'
  ]
  test.each(assets)('%s is an asset', pathname => {
    expect(isAssetPath(pathname)).toBe(true)
  })

  const pages = ['/', '/items/123', '/~pizza', '/pizza.com/items/123', '/rewards/2024-01-01']
  test.each(pages)('%s is not an asset', pathname => {
    expect(isAssetPath(pathname)).toBe(false)
  })
})

describe('resolveCaptureTarget', () => {
  describe('main domain', () => {
    test('resolves a path against the base url', () => {
      expect(resolve('/items/123')).toEqual({ href: 'https://stacker.news/items/123', domain: null })
    })

    test('keeps the query string, commentId included', () => {
      expect(resolve('/items/123?commentId=456').href).toBe('https://stacker.news/items/123?commentId=456')
    })

    test('resolves the root', () => {
      expect(resolve('/').href).toBe('https://stacker.news/')
    })

    test('still works when the allowlist is unavailable', () => {
      expect(resolve('/items/123', { allowedDomains: null }).href).toBe('https://stacker.news/items/123')
    })

    test.each([
      ['/rewards/2024-01-01', 'https://stacker.news/rewards/2024-01-01'],
      ['/~pizza/top/posts/day', 'https://stacker.news/~pizza/top/posts/day']
    ])('%s stays on the main domain', (originalUrl, href) => {
      expect(resolve(originalUrl).href).toBe(href)
    })
  })

  describe('escaping the base origin', () => {
    // a protocol-relative path (and its backslash variant, which the URL parser
    // normalizes to the same thing) would otherwise resolve to an attacker's origin
    test.each([
      '//evil.com/x',
      '/\\evil.com/x'
    ])('%s is rejected', originalUrl => {
      expect(resolve(originalUrl)).toEqual({ status: 400 })
    })
  })

  describe('asset paths', () => {
    test('main domain asset is a 404', () => {
      expect(resolve('/_next/static/chunk.js')).toEqual({ status: 404 })
    })

    // these contain a dot in the first segment, so they must be recognised as
    // assets BEFORE the custom-domain heuristic gets a chance to see a hostname
    test.each(['/site.webmanifest', '/favicon.ico', '/manifest.json'])('%s is a 404, not a domain', originalUrl => {
      expect(resolve(originalUrl)).toEqual({ status: 404 })
    })

    test('custom domain asset is a 404', () => {
      expect(resolve('/pizza.com/_next/static/chunk.js')).toEqual({ status: 404 })
    })
  })

  describe('custom domains', () => {
    test('resolves against the custom domain', () => {
      expect(resolve('/pizza.com/items/123')).toEqual({
        href: 'https://pizza.com/items/123',
        domain: 'pizza.com'
      })
    })

    test('resolves the domain root with no trailing slash', () => {
      expect(resolve('/pizza.com').href).toBe('https://pizza.com/')
    })

    test('resolves the domain root with a trailing slash', () => {
      expect(resolve('/pizza.com/').href).toBe('https://pizza.com/')
    })

    test('keeps the query string', () => {
      expect(resolve('/pizza.com/items/123?commentId=456').href)
        .toBe('https://pizza.com/items/123?commentId=456')
    })

    test('normalizes the host to lowercase', () => {
      expect(resolve('/PIZZA.COM/items/1')).toEqual({
        href: 'https://pizza.com/items/1',
        domain: 'pizza.com'
      })
    })

    test('handles a multi-label host', () => {
      expect(resolve('/www.foo.sndev/items/1').href).toBe('https://www.foo.sndev/items/1')
    })

    // dot-segments are collapsed by the URL parser before we ever split off the
    // host, so traversal can't climb out of the base origin into a custom domain
    test('cannot traverse out of the domain', () => {
      expect(resolve('/pizza.com/../../etc/passwd')).toEqual({
        href: 'https://stacker.news/etc/passwd',
        domain: null
      })
    })

    test('accepts an http target when asked to', () => {
      expect(resolve('/pizza.com/items/1', { protocol: 'http' }).href).toBe('http://pizza.com/items/1')
    })
  })

  describe('custom domains that are not allowed', () => {
    test('an unknown domain is rejected', () => {
      expect(resolve('/evil.com/items/1')).toEqual({ status: 400 })
    })

    // the allowlist only ever holds bare hostnames, so anything carrying a port,
    // userinfo or an extra label simply fails to match
    test.each([
      '/pizza.com:8080/items/1',
      '/pizza.com@evil.com/items/1',
      '/evil.com@pizza.com/items/1',
      '/pizza.com.evil.com/items/1',
      '/.pizza.com/items/1'
    ])('%s is rejected', originalUrl => {
      expect(resolve(originalUrl)).toEqual({ status: 400 })
    })

    test('an empty allowlist rejects every domain', () => {
      expect(resolve('/pizza.com/items/1', { allowedDomains: new Set() })).toEqual({ status: 400 })
    })

    // no allowlist means we cannot prove the domain is ours: ask the caller to
    // retry rather than serving (and caching) a wrong answer
    test('an unavailable allowlist asks for a retry', () => {
      expect(resolve('/pizza.com/items/1', { allowedDomains: null })).toEqual({ status: 503 })
    })
  })

  describe('malformed input', () => {
    // express always hands us a path; anything else is not a request we understand
    test.each([
      '',
      'not a url',
      'items/123',
      'https://evil.com/x',
      null,
      undefined
    ])('%p is rejected', originalUrl => {
      expect(resolve(originalUrl)).toEqual({ status: 400 })
    })
  })
})
