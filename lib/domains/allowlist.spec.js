/* eslint-env jest */
import { buildAllowlist, isAuthorizedCaptureRequest } from './allowlist'

describe('buildAllowlist', () => {
  const mappings = {
    'pizza.com': { id: 1, domainName: 'pizza.com', subName: 'pizza', tokenVersion: 3 },
    'www.foo.sndev': { id: 2, domainName: 'www.foo.sndev', subName: 'foo', tokenVersion: 0 }
  }

  test('returns only the domain names', () => {
    expect(buildAllowlist(mappings)).toEqual(['pizza.com', 'www.foo.sndev'])
  })

  // the cache returns null when there are no ACTIVE domains at all
  test.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty map', {}]
  ])('%s yields an empty list', (_label, input) => {
    expect(buildAllowlist(input)).toEqual([])
  })

  test('normalizes to lowercase', () => {
    expect(buildAllowlist({ 'PIZZA.com': { domainName: 'PIZZA.com' } })).toEqual(['pizza.com'])
  })

  // stable order keeps the response byte-identical between calls
  test('sorts the domains', () => {
    expect(buildAllowlist({ 'b.com': {}, 'a.com': {}, 'c.com': {} })).toEqual(['a.com', 'b.com', 'c.com'])
  })

  test('drops empty entries', () => {
    expect(buildAllowlist({ '': {}, 'pizza.com': {} })).toEqual(['pizza.com'])
  })

  test('leaks nothing but the domain names', () => {
    expect(JSON.stringify(buildAllowlist(mappings))).not.toMatch(/tokenVersion|subName/)
  })
})

describe('isAuthorizedCaptureRequest', () => {
  const secret = 'a'.repeat(32)

  test('accepts the configured secret', () => {
    expect(isAuthorizedCaptureRequest(`Bearer ${secret}`, secret)).toBe(true)
  })

  // RFC 7235: the auth scheme is case-insensitive
  test('accepts a lowercase scheme', () => {
    expect(isAuthorizedCaptureRequest(`bearer ${secret}`, secret)).toBe(true)
  })

  test('rejects the wrong secret', () => {
    expect(isAuthorizedCaptureRequest(`Bearer ${'b'.repeat(32)}`, secret)).toBe(false)
  })

  // a length mismatch must be a plain false, not a timingSafeEqual throw
  test.each([
    ['a shorter secret', `Bearer ${'a'.repeat(31)}`],
    ['a longer secret', `Bearer ${'a'.repeat(33)}`],
    ['a prefix of the header', 'Bearer '],
    ['no scheme', secret],
    ['the wrong scheme', `Basic ${secret}`],
    ['an empty header', ''],
    ['a missing header', undefined],
    ['a header array', [`Bearer ${secret}`]]
  ])('rejects %s', (_label, authorization) => {
    expect(isAuthorizedCaptureRequest(authorization, secret)).toBe(false)
  })

  // an unset env var must deny everything rather than authorize everything
  test.each([
    ['undefined', undefined],
    ['empty', ''],
    ['null', null]
  ])('rejects every request when the secret is %s', (_label, unset) => {
    expect(isAuthorizedCaptureRequest(`Bearer ${unset}`, unset)).toBe(false)
    expect(isAuthorizedCaptureRequest('Bearer anything', unset)).toBe(false)
  })
})
