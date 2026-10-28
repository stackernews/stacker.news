/* eslint-env jest */
import { capturePath, captureUrl } from './capture'

const domain = { subName: 'pizza', domainName: 'pizza.com' }
// a mapping whose domainName we couldn't resolve: keep the pre-#2997 behaviour
const subOnly = { subName: 'pizza' }

describe('capturePath', () => {
  describe('on the main site', () => {
    test.each([
      ['null branding', null],
      ['undefined branding', undefined],
      ['branding with neither domain nor sub', {}]
    ])('%s leaves the path alone', (_label, branding) => {
      expect(capturePath({ path: '/items/123', branding })).toBe('/items/123')
      expect(capturePath({ path: '/', branding })).toBe('/')
    })
  })

  describe('on a custom domain', () => {
    test('prefixes the domain', () => {
      expect(capturePath({ path: '/items/123', branding: domain })).toBe('/pizza.com/items/123')
    })

    // the root would otherwise become "/pizza.com/", which is a different cache key
    // for the same capture
    test('has no trailing slash at the root', () => {
      expect(capturePath({ path: '/', branding: domain })).toBe('/pizza.com')
    })

    test('keeps the query string', () => {
      expect(capturePath({ path: '/search?q=pizza', branding: domain })).toBe('/pizza.com/search?q=pizza')
    })

    // paths are already domain-local: proxy.js rewrote /~pizza away before the browser saw it
    test('does not re-add the sub name', () => {
      expect(capturePath({ path: '/top/posts/day', branding: domain })).toBe('/pizza.com/top/posts/day')
    })
  })

  describe('falling back to the territory path', () => {
    test('prefixes the sub name when the domain is unknown', () => {
      expect(capturePath({ path: '/items/123', branding: subOnly })).toBe('/~pizza/items/123')
    })

    test('has no trailing slash at the root', () => {
      expect(capturePath({ path: '/', branding: subOnly })).toBe('/~pizza')
    })
  })
})

describe('captureUrl', () => {
  test('builds an absolute url on the capture host', () => {
    expect(captureUrl({ path: '/items/123', branding: null })).toBe('https://capture.stacker.news/items/123')
  })

  test('builds an absolute url for a custom domain', () => {
    expect(captureUrl({ path: '/items/123', branding: domain })).toBe('https://capture.stacker.news/pizza.com/items/123')
  })
})
