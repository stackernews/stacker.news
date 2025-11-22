import { gfmFromMarkdown } from 'mdast-util-gfm'
import { visit } from 'unist-util-visit'
import { gfm } from 'micromark-extension-gfm'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { underline, highlight } from './micromark/extensions'
import { delimitedSpanFromMarkdown } from './micromark/glue'

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

export function mdParse (md) {
  if (!md) return { types: [], has: () => false }

  const tree = fromMarkdown(md, {
    extensions: [{ disable: { null: ['codeIndented'] } }, gfm(), underline(), highlight()],
    mdastExtensions: [
      gfmFromMarkdown(),
      delimitedSpanFromMarkdown('underline'),
      delimitedSpanFromMarkdown('highlight')]
  })

  const nodeTypes = new Set()

  visit(tree, (node) => {
    if (node.type === 'list') {
      if (node.ordered) {
        nodeTypes.add('number')
      } else {
        if (node.children.every(item => item.checked !== null)) {
          nodeTypes.add('check')
        } else if (node.children.some(item => item.checked !== null)) {
          nodeTypes.add('check')
          nodeTypes.add('bullet')
        } else {
          nodeTypes.add('bullet')
        }
      }
    } else if (node.type === 'heading') {
      nodeTypes.add(`h${node.depth}`)
    } else if (node.type === 'code') {
      nodeTypes.add('code')
    } else {
      nodeTypes.add(node.type)
    }
  })

  return {
    types: Array.from(nodeTypes),
    has: (type) => nodeTypes.has(type)
  }
}

export function extractUrls (md) {
  if (!md) return []
  const tree = fromMarkdown(md, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  })

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
