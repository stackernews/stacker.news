import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCaptureUrl } from './resolve-url.js'

const base = new URL('https://stacker.news/')

test('ordinary paths keep the configured origin without lookup', async () => {
  const url = await resolveCaptureUrl('/items/123?commentId=456', base, () => assert.fail('unexpected lookup'))
  assert.equal(url.href, 'https://stacker.news/items/123?commentId=456')
})

test('only the application authority approves a custom domain', async () => {
  const url = await resolveCaptureUrl('/Example.com/items/123?commentId=456', base, async (lookup, options) => {
    assert.equal(lookup.origin, base.origin)
    assert.equal(lookup.pathname, '/api/capture-domain')
    assert.equal(lookup.searchParams.get('domain'), 'Example.com')
    assert.equal(options.redirect, 'error')
    return { ok: true, json: async () => ({ domain: 'example.com' }) }
  })
  assert.equal(url.href, 'https://example.com/items/123?commentId=456')
})

test('foreign origins and malformed domain segments are rejected', async () => {
  for (const path of ['//evil.com/items/1', 'https://evil.com/items/1', '/example.com:443/items/1', '/example.com@evil.com/items/1']) {
    await assert.rejects(resolveCaptureUrl(path, base, () => assert.fail('unexpected lookup')))
  }
})

test('inactive, unavailable, redirected and mismatched mappings fail closed', async () => {
  for (const fetcher of [
    async () => ({ ok: false }),
    async () => { throw new Error('network or redirect') },
    async () => ({ ok: true, json: async () => ({ domain: 'other.com' }) }),
    async () => ({ ok: true, json: async () => { throw new Error('bad JSON') } })
  ]) await assert.rejects(resolveCaptureUrl('/example.com/items/1', base, fetcher))
})

test('double slash in the remaining path cannot change the target origin', async () => {
  const url = await resolveCaptureUrl('/example.com//evil.com/items/1', base, async () => ({ok: true, json: async () => ({domain: 'example.com'})}))
  assert.equal(url.origin, 'https://example.com')
  assert.equal(url.pathname, '//evil.com/items/1')
})
