/* eslint-env jest */
import { formatSankeyValue, getSankeyData } from './payIn/sankey/data'

describe('pay-in sankey data', () => {
  test('formats chart values with the active locale', () => {
    expect(formatSankeyValue(1234.56, 'en-US')).toBe('1,234.56')
    expect(formatSankeyValue(1234.56, 'de-DE')).toBe('1.234,56')
  })

  test('uses numeric link values so nivo can localize them', () => {
    const data = getSankeyData({
      mcost: 1234560,
      payOutCustodialTokens: [{
        payOutType: 'REWARDS_POOL',
        mtokens: 1234560,
        custodialTokenType: 'SATS'
      }]
    })

    expect(data.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'sats',
        target: '',
        value: 1234.56,
        asset: expect.stringMatching(/sats$/)
      }),
      expect.objectContaining({
        source: '',
        target: 'rewards',
        value: 1234.56,
        asset: expect.stringMatching(/sats$/)
      })
    ]))
    expect(data.links.every(link => typeof link.value === 'number')).toBe(true)
  })
})
