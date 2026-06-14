/* eslint-env jest */
jest.mock('unist-util-visit', () => ({
  visit: (tree, type, visitor) => {
    function walk (node, parent) {
      if (!node?.children) return

      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        if (child.type === type) {
          const nextIndex = visitor(child, i, node)
          if (typeof nextIndex === 'number') i = nextIndex
        }
        walk(child, node)
      }
    }

    walk(tree)
  }
}))

jest.mock('mdast-util-to-string', () => ({
  toString: (node) => {
    if (!node?.children) return node?.value || ''
    return node.children.map(child => child.value || '').join('')
  }
}))

const { trailingUnderscoreLinkTransform, misleadingLinkTransform } = require('./links.js')

// Mirrors mdast-util-gfm parsing of `https://example.com/path_`:
// a bare autolink node followed by a text node containing the trailing `_`.
function parsedBareAutolinkTree (url, suffix = '') {
  return {
    type: 'root',
    children: [{
      type: 'paragraph',
      children: [
        { type: 'text', value: 'see ' },
        {
          type: 'link',
          url,
          title: null,
          position: { start: { offset: 4 }, end: { offset: 4 + url.length } },
          children: [{
            type: 'text',
            value: url,
            position: { start: { offset: 4 }, end: { offset: 4 + url.length } }
          }]
        },
        ...(suffix ? [{ type: 'text', value: suffix }] : [])
      ]
    }]
  }
}

function explicitMarkdownLinkTree (url, suffix = '') {
  return {
    type: 'root',
    children: [{
      type: 'paragraph',
      children: [
        {
          type: 'link',
          url,
          title: null,
          position: { start: { offset: 0 }, end: { offset: (url.length * 2) + 4 } },
          children: [{ type: 'text', value: url }]
        },
        ...(suffix ? [{ type: 'text', value: suffix }] : [])
      ]
    }]
  }
}

function firstParagraphChildren (tree) {
  return tree.children[0].children
}

describe('trailingUnderscoreLinkTransform', () => {
  test('restores one trailing underscore excluded from a bare autolink', () => {
    const tree = parsedBareAutolinkTree('https://twitter.com/some_user', '_')

    trailingUnderscoreLinkTransform(tree)

    const link = firstParagraphChildren(tree)[1]
    expect(link.type).toBe('link')
    expect(link.url).toBe('https://twitter.com/some_user_')
    expect(link.children).toEqual([{ type: 'text', value: 'https://twitter.com/some_user_' }])
    expect(firstParagraphChildren(tree)).toHaveLength(2)
  })

  test('restores multiple trailing underscores before text boundary', () => {
    const tree = parsedBareAutolinkTree('https://example.com/path', '__ and more')

    trailingUnderscoreLinkTransform(tree)

    const children = firstParagraphChildren(tree)
    expect(children[1].url).toBe('https://example.com/path__')
    expect(children[2]).toMatchObject({ type: 'text', value: ' and more' })
  })

  test('does not merge explicit markdown link suffixes', () => {
    const tree = explicitMarkdownLinkTree('https://example.com/path', '_')

    trailingUnderscoreLinkTransform(tree)

    const children = firstParagraphChildren(tree)
    expect(children[0].url).toBe('https://example.com/path')
    expect(children[1]).toMatchObject({ type: 'text', value: '_' })
  })

  test('does not steal underscores that begin a word after a URL', () => {
    const tree = parsedBareAutolinkTree('https://example.com/path', '__bold')

    trailingUnderscoreLinkTransform(tree)

    const children = firstParagraphChildren(tree)
    expect(children[1].url).toBe('https://example.com/path')
    expect(children[2]).toMatchObject({ type: 'text', value: '__bold' })
  })

  test('runs before misleading link normalization without rewriting the restored URL text', () => {
    const tree = parsedBareAutolinkTree('https://example.com/path', '_')

    trailingUnderscoreLinkTransform(tree)
    misleadingLinkTransform(tree)

    const link = firstParagraphChildren(tree)[1]
    expect(link.url).toBe('https://example.com/path_')
    expect(link.children).toEqual([{ type: 'text', value: 'https://example.com/path_' }])
  })
})
