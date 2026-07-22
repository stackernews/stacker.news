/* eslint-env jest */

import { getLinkTextFormat } from './mention-format'
import { IS_BOLD, IS_ITALIC } from './format-constants'

describe('getLinkTextFormat', () => {
  it('reads italic formatting from an internal link label', () => {
    expect(getLinkTextFormat({
      type: 'link',
      children: [{
        type: 'emphasis',
        children: [{ type: 'text', value: 'High Risk, Low Reward' }]
      }]
    })).toBe(IS_ITALIC)
  })

  it('combines nested formatting flags', () => {
    expect(getLinkTextFormat({
      type: 'link',
      children: [{
        type: 'strong',
        children: [{
          type: 'emphasis',
          children: [{ type: 'text', value: 'formatted' }]
        }]
      }]
    })).toBe(IS_BOLD | IS_ITALIC)
  })

  it('returns the default format for plain link text', () => {
    expect(getLinkTextFormat({
      type: 'link',
      children: [{ type: 'text', value: 'plain' }]
    })).toBe(0)
  })
})
