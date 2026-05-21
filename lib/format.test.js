/* eslint-env jest */

import { msatsToSatsDecimal, numWithUnits } from './format'

describe('msatsToSatsDecimal', () => {
  test('returns a number so unit labels and locale formatting work', () => {
    const sats = msatsToSatsDecimal(1000)

    expect(sats).toBe(1)
    expect(numWithUnits(sats, { abbreviate: false })).toBe('1 sat')
  })

  test('preserves sub-sat precision', () => {
    expect(msatsToSatsDecimal(1234)).toBe(1.234)
  })
})
