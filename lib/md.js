import { gfmFromMarkdown } from 'mdast-util-gfm'
import { visit } from 'unist-util-visit'
import { gfm } from 'micromark-extension-gfm'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { visitParents } from 'unist-util-visit-parents'
import { parseEmbedUrl } from './url'

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

export function rehypeInlineCodeProperty () {
  return function (tree) {
    visit(tree, { tagName: 'code' }, function (node, index, parent) {
      if (parent && parent.tagName === 'pre') {
        node.properties.inline = false
      } else {
        node.properties.inline = true
      }
    })
  }
}

export function rehypeWrapText () {
  return function wrapTextTransform (tree) {
    visitParents(tree, 'text', (node, ancestors) => {
      // if the text is not a link or wrapped in a span
      // and if any of its parent's siblings are text, wrap it in a span
      // unless it's an empty string
      if (!['span', 'a'].includes(ancestors.at(-1).tagName) &&
          ancestors.at(-2)?.children.some(s => s.type === 'text') &&
          node.value.trim()) {
        node.children = [{ type: 'text', value: node.value }]
        node.type = 'element'
        node.tagName = 'span'
        node.properties = { }
      }
    })
  }
}

export function rehypeEmbed () {
  return function wrapTextTransform (tree) {
    visitParents(tree, 'text', (node, ancestors) => {
      // if this parent is a link and its parent doesn't have any text, embed
      if (['a'].includes(ancestors.at(-1).tagName) &&
          !ancestors.at(-2)?.children?.some(s => s.type === 'text' && s.value.trim()) &&
          node.value.trim() &&
          ancestors.at(-1).properties?.href === node.value) {
        const embed = parseEmbedUrl(node.value)
        if (embed) {
          node.children = [{ type: 'text', value: node.value }]
          node.type = 'element'
          node.tagName = 'embed'
          node.properties = { ...embed, src: node.value }
        }
      }
    })
  }
}

export function rehypeStyler (startTag, endTag, className) {
  return function (tree) {
    visit(tree, 'element', (node) => {
      for (let i = 0; i < node.children.length; i += 1) {
        const start = node.children[i]
        const text = node.children[i + 1]
        const end = node.children[i + 2]

        // is this a children slice wrapped with the tags we're looking for?
        const isWrapped =
          start?.type === 'raw' && start?.value === startTag &&
          text?.type === 'text' &&
          end?.type === 'raw' && end?.value === endTag
        if (!isWrapped) continue

        const newChildren = {
          type: 'element',
          tagName: 'span',
          properties: { className: [className] },
          children: [{ type: 'text', value: text.value }]
        }
        node.children.splice(i, 3, newChildren)
      }
    })
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
