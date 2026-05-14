/* eslint-env jest */

jest.mock('@nivo/sankey', () => ({
  ResponsiveSankey: () => null
}))

const { formatSankeyValue, getSankeyData } = require('../payIn/sankey')

describe('PayInSankey formatting', () => {
  let numberFormat

  beforeEach(() => {
    numberFormat = jest.spyOn(Intl, 'NumberFormat').mockImplementation(function () {
      return {
        format: value => `formatted ${value}`
      }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('formats Nivo Sankey values with Intl.NumberFormat', () => {
    expect(formatSankeyValue(1234567.89)).toBe('formatted 1234567.89')
    expect(numberFormat).toHaveBeenCalled()
  })

  test('formats Sankey node and link assets with localized full values', () => {
    const data = getSankeyData({
      mcost: 1234567890
    })

    const satsNode = data.nodes.find(node => node.id === 'sats')
    expect(satsNode.asset).toBe('formatted 1234567.89 sats')

    expect(data.links).toEqual([
      expect.objectContaining({
        source: 'sats',
        target: '',
        value: 1234567.89,
        asset: 'formatted 1234567.89 sats'
      })
    ])
  })
})
