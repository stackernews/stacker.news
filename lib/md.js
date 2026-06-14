import { gfmFromMarkdown } from 'mdast-util-gfm'
import { visit } from 'unist-util-visit'
import { gfm } from 'micromark-extension-gfm'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { mentionTransform } from './lexical/mdast/transforms/mentions.js'

function parseMarkdown (md) {
  if (!md) return []
  return fromMarkdown(md, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  })
}

export function mdHas (md, test) {
  if (!md) return []
  const tree = parseMarkdown(md)
  let found = false
  visit(tree, test, () => {
    found = true
    return false
  })

  return found
}

export function extractUrls (md) {
  if (!md) return []
  const tree = parseMarkdown(md)

  const urls = new Set()
  visit(tree, ({ type }) => {
    return type === 'link' || type === 'image'
  }, ({ url }) => {
    urls.add(url)
  })

  return Array.from(urls)
}

export function extractUserMentions (md) {
  if (!md) return []
  const tree = parseMarkdown(md)
  mentionTransform(tree)

  const names = new Set()
  visit(tree, 'userMention', ({ value }) => {
    if (value?.name) names.add(value.name)
  })
  return Array.from(names)
}

export const quote = (orig) =>
  orig.split('\n')
    .map(line => `> ${line}`)
    .join('\n') + '\n'

/** checks if the markdown string is a markdown link */
export function hasMarkdownLink (markdown) {
  return /\[.*\]\(.*\)/.test(markdown)
}
