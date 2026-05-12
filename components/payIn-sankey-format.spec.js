/* eslint-env jest */

import { formatSankeyAsset, formatSankeyValue } from './payIn/sankey/format'

describe('PayIn Sankey formatting', () => {
  test('localizes chart values', () => {
    expect(formatSankeyValue('1234.567')).toBe(new Intl.NumberFormat().format(1234.567))
  })

  test('localizes assets while preserving their unit labels', () => {
    const formatted = new Intl.NumberFormat().format(1234.567)

    expect(formatSankeyAsset(1234567, 'SATS')).toBe(`${formatted} sats`)
    expect(formatSankeyAsset(1234567, 'CREDITS')).toBe(`${formatted} CCs`)
  })
})
