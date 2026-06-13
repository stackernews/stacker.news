/* eslint-env jest */

jest.mock('unist-util-visit', () => ({
  visit: (node, type, visitor) => {
    function walk (current, parent) {
      if (!current?.children) return
      for (let index = 0; index < current.children.length; index++) {
        const child = current.children[index]
        if (child.type === type) {
          const nextIndex = visitor(child, index, current)
          if (typeof nextIndex === 'number') {
            index = nextIndex
          }
        }
        walk(current.children[index], current)
      }
    }

    walk(node, null)
  }
}))

jest.mock('mdast-util-to-string', () => ({
  toString: (node) => {
    if (typeof node?.value === 'string') return node.value
    if (typeof node?.alt === 'string') return node.alt
    return node?.children?.map(child => child.value ?? child.alt ?? '').join('') ?? ''
  }
}))

const { trailingUnderscoreAutolinkTransform } = require('./links')

function transformChildren (children) {
  const tree = {
    type: 'root',
    children: [{
      type: 'paragraph',
      children
    }]
  }
  trailingUnderscoreAutolinkTransform(tree)
  return tree.children[0].children
}

function gfmBareAutolink (url) {
  return {
    type: 'link',
    url,
    children: [{ type: 'text', value: url }]
  }
}

describe('trailingUnderscoreAutolinkTransform', () => {
  test('restores a trailing underscore from the text node GFM parses after a bare autolink', () => {
    const [link] = transformChildren([
      gfmBareAutolink('https://twitter.com/some_user'),
      { type: 'text', value: '_' }
    ])

    expect(link).toMatchObject({
      type: 'link',
      url: 'https://twitter.com/some_user_',
      children: [{ type: 'text', value: 'https://twitter.com/some_user_' }]
    })
  })

  test('restores multiple trailing underscores from the text node GFM parses after a bare autolink', () => {
    const [link] = transformChildren([
      gfmBareAutolink('https://example.com/path'),
      { type: 'text', value: '__' }
    ])

    expect(link.url).toBe('https://example.com/path__')
    expect(link.children[0].value).toBe('https://example.com/path__')
  })

  test('preserves text after trailing autolink underscores', () => {
    const [link, text] = transformChildren([
      gfmBareAutolink('https://example.com/path'),
      { type: 'text', value: '__ suffix' }
    ])

    expect(link.url).toBe('https://example.com/path__')
    expect(text).toMatchObject({ type: 'text', value: ' suffix' })
  })

  test('does not change explicit markdown links', () => {
    const [link] = transformChildren([
      {
        type: 'link',
        url: 'https://example.com/path_',
        children: [{ type: 'text', value: 'example' }]
      }
    ])

    expect(link).toMatchObject({
      type: 'link',
      url: 'https://example.com/path_',
      children: [{ type: 'text', value: 'example' }]
    })
  })
})
