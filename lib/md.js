import { gfmFromMarkdown } from 'mdast-util-gfm'
import { mathFromMarkdown } from 'mdast-util-math'
import { toString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'
import { gfm } from 'micromark-extension-gfm'
import { math } from 'micromark-extension-math'
import { fromMarkdown } from 'mdast-util-from-markdown'
import removeMd from 'remove-markdown'

function markdownTree (md) {
  return fromMarkdown(md, {
    extensions: [gfm(), math({ singleDollarTextMath: false })],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()]
  })
}

export function mdHas (md, test) {
  if (!md) return []
  const tree = markdownTree(md)

  let found = false
  visit(tree, test, () => {
    found = true
    return false
  })

  return found
}

export function extractUrls (md) {
  if (!md) return []
  const tree = markdownTree(md)

  const urls = new Set()
  visit(tree, ({ type }) => {
    return type === 'link' || type === 'image'
  }, ({ url }) => {
    urls.add(url)
  })

  return Array.from(urls)
}

export const quote = (orig) =>
  orig.split('\n')
    .map(line => `> ${line}`)
    .join('\n') + '\n'

export function mdToPlainText (md) {
  if (!md) return ''

  try {
    return toString(markdownTree(md))
      .replace(/\\([,;:!])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return removeMd(md)
      .replace(/\s+/g, ' ')
      .trim()
  }
}

/** checks if the markdown string is a markdown link */
export function hasMarkdownLink (markdown) {
  return /\[.*\]\(.*\)/.test(markdown)
}
