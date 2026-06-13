/* eslint-env jest */

import { compactPlainText, nodePlainText } from './md-plain-text'

const text = value => ({ type: 'text', value })
const paragraph = children => ({ type: 'paragraph', children })

describe('compactPlainText', () => {
  test('normalizes whitespace and notification-safe escapes', () => {
    expect(compactPlainText(' ok\\! \n next\\: value  ')).toBe('ok! next: value')
  })
})

describe('nodePlainText', () => {
  test('keeps block and list item text separated', () => {
    const tree = {
      type: 'root',
      children: [
        paragraph([text('list:')]),
        {
          type: 'list',
          children: [
            { type: 'listItem', children: [paragraph([text('one')])] },
            { type: 'listItem', children: [paragraph([text('two')])] },
            { type: 'listItem', children: [paragraph([text('three')])] }
          ]
        }
      ]
    }

    expect(compactPlainText(nodePlainText(tree))).toBe('list: one two three')
  })

  test('keeps table cells separated', () => {
    const tree = {
      type: 'table',
      children: [
        { type: 'tableRow', children: [{ type: 'tableCell', children: [text('a')] }, { type: 'tableCell', children: [text('b')] }] },
        { type: 'tableRow', children: [{ type: 'tableCell', children: [text('c')] }, { type: 'tableCell', children: [text('d')] }] }
      ]
    }

    expect(compactPlainText(nodePlainText(tree))).toBe('a b c d')
  })

  test('renders formatted inline content without URLs or markdown syntax', () => {
    const tree = paragraph([
      { type: 'strong', children: [text('bold')] },
      text(' '),
      { type: 'link', url: 'https://example.com', children: [text('link')] },
      text(', ok\\!')
    ])

    expect(compactPlainText(nodePlainText(tree))).toBe('bold link, ok!')
  })

  test('preserves prices, inline code, code blocks, and image alt text', () => {
    const tree = {
      type: 'root',
      children: [
        paragraph([text('fees are $1..$5 and '), { type: 'inlineCode', value: 'x = 1' }]),
        { type: 'code', lang: 'js', value: 'const y = 2' },
        { type: 'image', url: 'https://example.com/image.png', alt: 'chart' }
      ]
    }

    expect(compactPlainText(nodePlainText(tree))).toBe('fees are $1..$5 and x = 1 const y = 2 chart')
  })
})
