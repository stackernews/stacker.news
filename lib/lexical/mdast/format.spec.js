/* eslint-env jest */

import {
  IS_BOLD,
  IS_CODE,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_UNDERLINE
} from './format-constants.js'
import { formatTextAsMdastChildren, formatToClassName } from './format.js'

describe('formatToClassName', () => {
  test('returns text format classes', () => {
    expect(formatToClassName(IS_BOLD | IS_ITALIC)).toBe('sn-text__bold sn-text__italic')
  })

  test('uses a combined underline strikethrough class', () => {
    expect(formatToClassName(IS_UNDERLINE | IS_STRIKETHROUGH)).toBe('sn-text__underline-strikethrough')
  })

  test('returns an empty class name for unstyled text', () => {
    expect(formatToClassName(0)).toBe('')
  })
})

describe('formatTextAsMdastChildren', () => {
  test('wraps text with mdast formatting nodes', () => {
    expect(formatTextAsMdastChildren('High Risk', IS_ITALIC | IS_BOLD)).toEqual([
      {
        type: 'emphasis',
        children: [
          {
            type: 'strong',
            children: [{ type: 'text', value: 'High Risk' }]
          }
        ]
      }
    ])
  })

  test('preserves html formatting tags inside links', () => {
    expect(formatTextAsMdastChildren('High Risk', IS_UNDERLINE | IS_ITALIC)).toEqual([
      { type: 'html', value: '<ins>' },
      {
        type: 'emphasis',
        children: [{ type: 'text', value: 'High Risk' }]
      },
      { type: 'html', value: '</ins>' }
    ])
  })

  test('preserves inline code as a formatted leaf', () => {
    expect(formatTextAsMdastChildren('High Risk', IS_CODE | IS_ITALIC)).toEqual([
      {
        type: 'emphasis',
        children: [{ type: 'inlineCode', value: 'High Risk' }]
      }
    ])
  })
})
