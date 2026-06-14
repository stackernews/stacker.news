/* eslint-env jest */

jest.mock('unist-util-visit', () => ({
  visit: (tree, type, visitor) => {
    function walk (node) {
      node.children?.forEach((child, index) => {
        if (child.type === type) visitor(child, index, node)
        walk(child)
      })
    }
    if (tree.type === type) visitor(tree, undefined, undefined)
    walk(tree)
  }
}))

jest.mock('mdast-util-to-string', () => ({
  toString: node => {
    if (node.type === 'text') return node.value
    return node.children?.map(child => child.value ?? '').join('') ?? ''
  }
}))

const { fediverseHandleTransform } = require('./links.js')

function position (start, end) {
  return {
    start: { offset: start },
    end: { offset: end }
  }
}

function text (value, start, end) {
  return {
    type: 'text',
    value,
    position: position(start, end)
  }
}

function mailtoLink (value, start, end, { childStart = start, childEnd = end } = {}) {
  return {
    type: 'link',
    title: null,
    url: `mailto:${value}`,
    children: [text(value, childStart, childEnd)],
    position: position(start, end)
  }
}

function treeWithParagraph (children) {
  return {
    type: 'root',
    children: [{
      type: 'paragraph',
      children
    }]
  }
}

function transform (tree) {
  fediverseHandleTransform(tree)
  return tree
}

function linksIn (tree) {
  const links = []
  function walk (node) {
    if (node.type === 'link') links.push(node.url)
    node.children?.forEach(walk)
  }
  walk(tree)
  return links
}

function textIn (tree) {
  let result = ''
  function walk (node) {
    if (node.type === 'text') result += node.value
    node.children?.forEach(walk)
  }
  walk(tree)
  return result
}

describe('fediverseHandleTransform', () => {
  test('keeps fediverse handles as text instead of mailto links', () => {
    const tree = transform(treeWithParagraph([
      text('hello @', 0, 7),
      mailtoLink('Cointastical@BitcoinHackers.org', 7, 38)
    ]))

    expect(textIn(tree)).toBe('hello @Cointastical@BitcoinHackers.org')
    expect(linksIn(tree)).toEqual([])
  })

  test('keeps bang-prefixed handles as text instead of mailto links', () => {
    const tree = transform(treeWithParagraph([
      text('follow !', 0, 8),
      mailtoLink('group@instance.social', 8, 29)
    ]))

    expect(textIn(tree)).toBe('follow !group@instance.social')
    expect(linksIn(tree)).toEqual([])
  })

  test('keeps normal email autolinks', () => {
    const tree = transform(treeWithParagraph([
      text('email ', 0, 6),
      mailtoLink('hello@example.com', 6, 23)
    ]))

    expect(linksIn(tree)).toEqual(['mailto:hello@example.com'])
  })

  test('keeps explicit markdown mailto links after an at sign', () => {
    const tree = transform(treeWithParagraph([
      text('@', 0, 1),
      mailtoLink('Cointastical@BitcoinHackers.org', 1, 75, {
        childStart: 2,
        childEnd: 33
      })
    ]))

    expect(linksIn(tree)).toEqual(['mailto:Cointastical@BitcoinHackers.org'])
  })
})
