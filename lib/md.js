import { gfmFromMarkdown } from 'mdast-util-gfm'
import { visit } from 'unist-util-visit'
import { gfm } from 'micromark-extension-gfm'
import { fromMarkdown } from 'mdast-util-from-markdown'

export function mdHas (md, test) {
  if (!md) return []
  const tree = fromMarkdown(md, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  })

  let found = false
  visit(tree, test, () => {
    found = true
    return false
  })

  return found
}

// `limit` limits the number of urls collected while visiting the tree
// `type` narrows the search to a single mdast node type (e.g. 'image')
export function extractUrls (md, { limit, type } = {}) {
  if (!md) return []
  const tree = fromMarkdown(md, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  })

  const urls = new Set()
  visit(tree, (node) => {
    if (type) return node.type === type
    return node.type === 'link' || node.type === 'image'
  }, ({ url }) => {
    urls.add(url)
    if (limit && urls.size >= limit) return false
  })

  return Array.from(urls)
}

export const quote = (orig) =>
  orig.split('\n')
    .map(line => `> ${line}`)
    .join('\n') + '\n'

/** checks if the markdown string is a markdown link */
export function hasMarkdownLink (markdown) {
  return /\[.*\]\(.*\)/.test(markdown)
}
