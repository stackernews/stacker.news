/* eslint-env jest */

import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import { toString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'
import { fediverseHandleTransform } from './links.js'

// same syntax and mdast extensions $markdownToLexical uses, so the tree under
// test is the tree the editor and the renderer actually get
function parse (markdown) {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  })
  fediverseHandleTransform(tree)
  return tree
}

function links (tree) {
  const found = []
  visit(tree, 'link', node => { found.push(node) })
  return found
}

const handleCases = [
  '@Cointastical@BitcoinHackers.org',
  '!announcements@lemmy.world',
  'follow @alice@example.org for updates',
  'both @alice@example.org and !news@lemmy.world'
]

describe('fediverse handles', () => {
  test.each(handleCases)('%p is not linked', markdown => {
    const tree = parse(markdown)
    expect(links(tree)).toHaveLength(0)
    expect(toString(tree)).toBe(markdown)
  })
})

const emailCases = [
  ['contact@example.org', 'mailto:contact@example.org'],
  ['email me at contact@example.org please', 'mailto:contact@example.org'],
  ['(contact@example.org)', 'mailto:contact@example.org']
]

describe('ordinary email autolinks', () => {
  test.each(emailCases)('%p still links to %p', (markdown, url) => {
    const found = links(parse(markdown))
    expect(found).toHaveLength(1)
    expect(found[0].url).toBe(url)
  })
})

describe('explicit mailto links', () => {
  test('a labelled link after an @ keeps its link', () => {
    const found = links(parse('@[write to me](mailto:contact@example.org)'))
    expect(found).toHaveLength(1)
    expect(found[0].url).toBe('mailto:contact@example.org')
    expect(toString(found[0])).toBe('write to me')
  })
})
