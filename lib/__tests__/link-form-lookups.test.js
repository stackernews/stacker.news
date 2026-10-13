/* eslint-env jest */

import { planInitialUrlLookups, isMeaningfulUrl, hasExistingTitle } from '../link-form-lookups'

describe('planInitialUrlLookups', () => {
  const base = { url: 'https://example.com/article', title: '', draftTitle: null, isEditing: false }

  test('prefilled url plans title and dupes lookups when no title exists', () => {
    expect(planInitialUrlLookups(base)).toEqual({
      url: 'https://example.com/article',
      needsTitleLookup: true
    })
  })

  test('shared title suppresses the title lookup but keeps dupes', () => {
    expect(planInitialUrlLookups({ ...base, title: 'Letter #7: Notes from the Inside' })).toEqual({
      url: 'https://example.com/article',
      needsTitleLookup: false
    })
  })

  test('draft title suppresses the title lookup but keeps dupes', () => {
    expect(planInitialUrlLookups({ ...base, draftTitle: 'draft title' }).needsTitleLookup).toBe(false)
  })

  test('whitespace-only title still needs the title lookup', () => {
    expect(planInitialUrlLookups({ ...base, title: '   ' }).needsTitleLookup).toBe(true)
  })

  test('editing an existing item plans nothing', () => {
    expect(planInitialUrlLookups({ ...base, isEditing: true })).toBeNull()
  })

  test('missing url plans nothing', () => {
    expect(planInitialUrlLookups({ ...base, url: '' })).toBeNull()
    expect(planInitialUrlLookups({ ...base, url: undefined })).toBeNull()
  })

  test('unmeaningful url plans nothing', () => {
    expect(planInitialUrlLookups({ ...base, url: 'not a url' })).toBeNull()
    expect(planInitialUrlLookups({ ...base, url: 'localhost-only-word' })).toBeNull()
  })
})

describe('isMeaningfulUrl', () => {
  test('accepts dotted hostnames and localhost', () => {
    expect(isMeaningfulUrl('https://stacker.news/items/1')).toBe(true)
    expect(isMeaningfulUrl('example.com')).toBe(true)
    expect(isMeaningfulUrl('http://localhost:3000')).toBe(true)
  })

  test('rejects bare words and malformed input', () => {
    expect(isMeaningfulUrl('hello')).toBe(false)
    expect(isMeaningfulUrl('')).toBe(false)
  })
})

describe('hasExistingTitle', () => {
  test('counts current or draft titles', () => {
    expect(hasExistingTitle('a title', null)).toBe(true)
    expect(hasExistingTitle('', 'draft')).toBe(true)
    expect(hasExistingTitle('', '')).toBe(false)
    expect(hasExistingTitle(null, null)).toBe(false)
  })
})
