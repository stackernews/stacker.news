import { gfmFromMarkdown } from 'mdast-util-gfm'
import { visit } from 'unist-util-visit'
import { gfm } from 'micromark-extension-gfm'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { superscript, subscript } from '../components/text.module.css'

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

function rehypeStyler (startTag, endTag, className) {
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

// Explicitely defined start/end tags & which CSS class from text.module.css to apply
export const rehypeSuperscript = () => rehypeStyler('<sup>', '</sup>', superscript)
export const rehypeSubscript = () => rehypeStyler('<sub>', '</sub>', subscript)

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
