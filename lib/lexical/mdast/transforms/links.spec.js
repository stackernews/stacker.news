/* eslint-env jest */

import { trailingUnderscoreAutolinkTransform } from './links'

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

function autolink (url) {
  return {
    type: 'link',
    url,
    children: [{ type: 'text', value: url }]
  }
}

describe('trailingUnderscoreAutolinkTransform', () => {
  test('restores a trailing underscore to a bare autolink', () => {
    const [link] = transformChildren([
      autolink('https://twitter.com/some_user'),
      { type: 'text', value: '_' }
    ])

    expect(link).toMatchObject({
      type: 'link',
      url: 'https://twitter.com/some_user_',
      children: [{ type: 'text', value: 'https://twitter.com/some_user_' }]
    })
  })

  test('restores multiple trailing underscores to a bare autolink', () => {
    const [link] = transformChildren([
      autolink('https://example.com/path'),
      { type: 'text', value: '__' }
    ])

    expect(link.url).toBe('https://example.com/path__')
    expect(link.children[0].value).toBe('https://example.com/path__')
  })

  test('preserves text after trailing autolink underscores', () => {
    const [link, text] = transformChildren([
      autolink('https://example.com/path'),
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
