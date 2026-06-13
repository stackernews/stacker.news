/* eslint-env jest */

import { fediverseHandleTransform, malformedLinkEncodingTransform, misleadingLinkTransform } from './links'

function paragraphChildren (children, transform = fediverseHandleTransform) {
  const tree = {
    type: 'root',
    children: [{ type: 'paragraph', children }]
  }
  transform(tree)
  return tree.children[0].children
}

describe('fediverseHandleTransform', () => {
  test.each(['@', '!'])('does not autolink %s-prefixed fediverse handles as email', prefix => {
    const children = paragraphChildren([
      { type: 'text', value: prefix },
      {
        type: 'link',
        title: null,
        url: 'mailto:Cointastical@BitcoinHackers.org',
        children: [{ type: 'text', value: 'Cointastical@BitcoinHackers.org' }]
      }
    ])

    expect(children).toEqual([
      expect.objectContaining({ type: 'text', value: prefix }),
      { type: 'text', value: 'Cointastical@BitcoinHackers.org' }
    ])
  })

  test('keeps regular email autolinks intact', () => {
    const children = paragraphChildren([
      { type: 'text', value: 'mail me at ' },
      {
        type: 'link',
        title: null,
        url: 'mailto:user@example.com',
        children: [{ type: 'text', value: 'user@example.com' }]
      }
    ])

    expect(children[1]).toMatchObject({
      type: 'link',
      url: 'mailto:user@example.com',
      children: [{ type: 'text', value: 'user@example.com' }]
    })
  })

  test('keeps explicit email links intact after handle prefixes', () => {
    const children = paragraphChildren([
      { type: 'text', value: '@' },
      {
        type: 'link',
        title: null,
        url: 'mailto:user@example.com',
        children: [{ type: 'text', value: 'user@example.com' }],
        position: {
          start: { offset: 1 },
          end: { offset: 38 }
        }
      }
    ])

    expect(children[1]).toMatchObject({
      type: 'link',
      url: 'mailto:user@example.com',
      children: [{ type: 'text', value: 'user@example.com' }]
    })
  })
})

describe('misleadingLinkTransform', () => {
  test('replaces misleading link text with the link URL', () => {
    const children = paragraphChildren([
      {
        type: 'link',
        title: null,
        url: 'https://example.com',
        children: [{ type: 'text', value: 'https://stacker.news' }]
      }
    ], misleadingLinkTransform)

    expect(children[0]).toMatchObject({
      type: 'link',
      url: 'https://example.com',
      children: [{ type: 'text', value: 'https://example.com' }]
    })
  })

  test('unwraps image-only links', () => {
    const image = { type: 'image', url: 'https://example.com/cat.jpg', alt: 'cat' }
    const children = paragraphChildren([
      {
        type: 'link',
        title: null,
        url: 'https://example.com',
        children: [image]
      }
    ], misleadingLinkTransform)

    expect(children).toEqual([image])
  })
})

describe('malformedLinkEncodingTransform', () => {
  test('replaces malformed link URLs with text', () => {
    const children = paragraphChildren([
      {
        type: 'link',
        title: null,
        url: '%',
        children: [{ type: 'text', value: '%' }]
      }
    ], malformedLinkEncodingTransform)

    expect(children).toEqual([{ type: 'text', value: '%' }])
  })
})
