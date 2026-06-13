import { gfmFromMarkdown } from 'mdast-util-gfm'
import { mathFromMarkdown } from 'mdast-util-math'
import { visit } from 'unist-util-visit'
import { gfm } from 'micromark-extension-gfm'
import { math } from 'micromark-extension-math'
import { fromMarkdown } from 'mdast-util-from-markdown'
import removeMd from 'remove-markdown'
import { compactPlainText, nodePlainText } from '@/lib/md-plain-text'

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
    return compactPlainText(nodePlainText(markdownTree(md)))
  } catch {
    return compactPlainText(removeMd(md))
  }
}

/** checks if the markdown string is a markdown link */
export function hasMarkdownLink (markdown) {
  return /\[.*\]\(.*\)/.test(markdown)
}
