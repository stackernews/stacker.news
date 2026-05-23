/* eslint-env jest */

import { formatSankeyValue, getSankeyData } from './payIn/sankey/data'

describe('PayInSankey data formatting', () => {
  test('uses numeric values for Nivo and localized tooltip assets', () => {
    const data = getSankeyData({
      mcost: 1234567890,
      payerPrivates: {
        payInCustodialTokens: [
          {
            mtokens: 1234567890,
            custodialTokenType: 'SATS'
          }
        ]
      }
    })

    expect(data.links).toHaveLength(1)
    expect(data.links[0].value).toBe(1234567.89)
    expect(data.links[0].asset).toBe(`${new Intl.NumberFormat().format(1234567.89)} sats`)
  })

  test('formats one sat with the singular unit', () => {
    const data = getSankeyData({
      mcost: 1000,
      payerPrivates: {
        payInCustodialTokens: [
          {
            mtokens: 1000,
            custodialTokenType: 'SATS'
          }
        ]
      }
    })

    expect(data.links[0].asset).toBe('1 sat')
  })

  test('passes Nivo values through Intl.NumberFormat', () => {
    expect(formatSankeyValue(1234567.89)).toBe(new Intl.NumberFormat().format(1234567.89))
  })
})
