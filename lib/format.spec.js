/* eslint-env jest */

import { formatMsatsAsSats } from './format'

describe('formatMsatsAsSats', () => {
  test('formats integer sats without fractional digits', () => {
    expect(formatMsatsAsSats(149000, { locale: 'en-US' })).toBe('149')
  })

  test('formats grouped integer sats for the active locale', () => {
    expect(formatMsatsAsSats(4856000, { locale: 'en-US' })).toBe('4,856')
    expect(formatMsatsAsSats(4856000, { locale: 'de-DE' })).toBe('4.856')
  })

  test('formats fractional sats for the active locale', () => {
    expect(formatMsatsAsSats(4856, { locale: 'en-US' })).toBe('4.856')
    expect(formatMsatsAsSats(4856, { locale: 'de-DE' })).toBe('4,856')
  })
})
