/* eslint-env jest */

import { normalizeLineSeparators } from './text'

describe('normalizeLineSeparators (#546)', () => {
  const U2028 = '\u2028'
  const U2029 = '\u2029'
  const U0085 = '\u0085'

  test('replaces paragraph/line separators with a plain newline', () => {
    expect(normalizeLineSeparators(`a${U2028}b`)).toBe('a\nb')
    expect(normalizeLineSeparators(`a${U2029}b`)).toBe('a\nb')
    expect(normalizeLineSeparators(`a${U0085}b`)).toBe('a\nb')
    expect(normalizeLineSeparators(`${U2028}${U2029}${U0085}`)).toBe('\n\n\n')
  })

  test('handles the mixed content a macOS Notes paste produces', () => {
    const pasted = `first line${U2028}second line${U2029}${U2028}third line`
    expect(normalizeLineSeparators(pasted)).toBe('first line\nsecond line\n\nthird line')
  })

  test('is idempotent', () => {
    const once = normalizeLineSeparators(`a${U2028}b`)
    expect(normalizeLineSeparators(once)).toBe(once)
  })

  test('leaves ordinary whitespace alone', () => {
    expect(normalizeLineSeparators('a\nb\r\nc\td')).toBe('a\nb\r\nc\td')
    expect(normalizeLineSeparators('   ')).toBe('   ')
  })

  test('passes through non-strings and empties unchanged', () => {
    expect(normalizeLineSeparators('')).toBe('')
    expect(normalizeLineSeparators(null)).toBe(null)
    expect(normalizeLineSeparators(undefined)).toBe(undefined)
  })

  test('a crossposted body contains no invisible separators', () => {
    // mirrors itemToContent(): title, url, text and the backlink concatenated
    const item = {
      id: 123,
      title: `title${U2028}with separator`,
      url: 'https://example.com',
      text: `body${U2029}with separator`
    }
    const content = normalizeLineSeparators(
      `${item.title}\n${item.url}\n\n${item.text}\n\nhttps://stacker.news/items/${item.id}`.trim()
    )
    expect(content).not.toMatch(/[\u2028\u2029\u0085]/)
    expect(content).toContain('title\nwith separator')
  })
})
