/* eslint-env jest */

import fs from 'fs'
import path from 'path'
import { RESERVED_USER_NAMES } from './constants'
import { userSchema, validateSchema } from './validate'

const ROOT = process.cwd()
const PAGES_DIR = path.join(ROOT, 'pages')

// Routes that answer on a single top-level segment and therefore shadow
// pages/[name].js (the profile route). Two sources: static pages and rewrites.
function topLevelRoutes () {
  const routes = new Set()

  for (const entry of fs.readdirSync(PAGES_DIR, { withFileTypes: true })) {
    const name = entry.name.replace(/\.(js|jsx|ts|tsx)$/, '')
    // Next internals (_app, _document, _error), the dynamic profile route itself
    // ([name]) and anything hidden can't be typed as a nym
    if (name.startsWith('_') || name.startsWith('[') || name.startsWith('.')) continue

    if (entry.isDirectory()) {
      // /foo only exists if there's an index page; /foo/bar alone doesn't shadow /foo
      const hasIndex = fs.readdirSync(path.join(PAGES_DIR, entry.name))
        .some(f => /^index\.(js|jsx|ts|tsx)$/.test(f))
      if (hasIndex) routes.add(name.toLowerCase())
      continue
    }

    routes.add(name.toLowerCase())
  }

  // rewrites like { source: '/faq', destination: '/items/349' } serve /faq,
  // so they shadow a nym too. handled by regex on purpose: next.config.js is a
  // build-time file, importing it from a test would drag in the whole config.
  const config = fs.readFileSync(path.join(ROOT, 'next.config.js'), 'utf8')
  for (const [, source] of config.matchAll(/source:\s*'([^']+)'/g)) {
    const segment = source.replace(/^\//, '').split('/')[0]
    // single top-level segment only; '/~:sub/:slug*' and '/.well-known/...' are not nyms
    if (!segment || segment.includes(':') || segment.includes('~') || segment.startsWith('.')) continue
    if (source.split('/').filter(Boolean).length > 1 && !source.endsWith(':slug*')) continue
    routes.add(segment.toLowerCase())
  }

  // a route can only shadow a nym if the nym itself is a legal username:
  // nameValidator allows /^[\w_]+$/ only, so '/sw.js' or '/~' can never collide
  return [...routes].filter(route => /^\w+$/.test(route)).sort()
}

describe('reserved usernames (#630)', () => {
  test('every top-level route is reserved', () => {
    const missing = topLevelRoutes().filter(route => !RESERVED_USER_NAMES.includes(route))
    expect(missing).toEqual([])
  })

  test('the reserved list has no duplicates', () => {
    expect(new Set(RESERVED_USER_NAMES).size).toBe(RESERVED_USER_NAMES.length)
  })

  test('userSchema rejects reserved nyms, case-insensitively', async () => {
    const models = { user: { findUnique: async () => null } }
    for (const name of ['404', '500', 'settings', 'SEARCH', 'Faq']) {
      await expect(validateSchema(userSchema, { name }, { models })).rejects.toThrow(/reserved/)
    }
  })

  test('userSchema still accepts a free name', async () => {
    const models = { user: { findUnique: async () => null } }
    await expect(validateSchema(userSchema, { name: 'owlstack' }, { models })).resolves.toBeTruthy()
  })
})
