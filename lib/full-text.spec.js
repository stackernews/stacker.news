/* eslint-env jest */

import { fullTextAsPath, shouldShowFullTextForPath } from './full-text'

describe('full text route state', () => {
  test('adds the matching item id to a clean item path', () => {
    expect(fullTextAsPath('/items/123', 123)).toBe('/items/123?fullText=123')
  })

  test('preserves existing query params and hash fragments', () => {
    expect(fullTextAsPath('/items/123?sort=recent#comments', 123))
      .toBe('/items/123?sort=recent&fullText=123#comments')
  })

  test('replaces stale full text ids', () => {
    expect(fullTextAsPath('/items/123?fullText=456&sort=recent', 123))
      .toBe('/items/123?fullText=123&sort=recent')
  })

  test('expands hash links and matching item ids only', () => {
    expect(shouldShowFullTextForPath('/items/123#section', 456)).toBe(true)
    expect(shouldShowFullTextForPath('/items/123?fullText=123', 123)).toBe(true)
    expect(shouldShowFullTextForPath('/items/123?fullText=456', 123)).toBe(false)
  })
})
