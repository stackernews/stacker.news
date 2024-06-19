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

// Adds styling to string between two tags by dropping it in <span> with appropriate CSS class
function escapeRegex (string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rehypeStyler (startTag, endTag, className) {
  const escapedStartTag = escapeRegex(startTag)
  const escapedEndTag = escapeRegex(endTag)
  const regex = new RegExp(`${escapedStartTag}(.*?)${escapedEndTag}`, 'g')

  return function (tree) {
    visit(tree, (node, index, parent) => {
      if (['text', 'raw'].includes(node.type) && typeof node.value === 'string') {
        const newChildren = []
        let lastIndex = 0
        node.value.replace(regex, (match, p1, offset) => {
          // Add text before match
          if (offset > lastIndex) {
            newChildren.push({ type: 'text', value: node.value.slice(lastIndex, offset) })
          }
          // Add transformed span
          newChildren.push({
            type: 'element',
            tagName: 'span',
            properties: { className: [className] },
            children: [{ type: 'text', value: p1 }]
          })
          lastIndex = offset + match.length
        })
        // Add text after last match
        if (lastIndex < node.value.length) {
          newChildren.push({ type: 'text', value: node.value.slice(lastIndex) })
        }
        // Replace the original node with the new children
        parent.children.splice(index, 1, ...newChildren)
      }
    })
  }
}

// Explicitely defined start/end tags & which CSS class from text.module.css to apply
export const rehypeSuperscript = () => rehypeStyler('^', '^', superscript)
export const rehypeSubscript = () => rehypeStyler('<sub>', '</sub>', subscript)

// ================================= BEGIN OLD CODE =============================
// const subChar = '_'
// const supChar = '^'

// export function rehypeSuperscriptAndSubscript () {
//   return function (tree) {
//     visit(tree, 'text', (node, index, parent) => {
//       if (typeof node.value === 'string') {
//         const parts = node.value.split(combinedRegex).map(part => {
//           if (part.startsWith(supChar) && part.endsWith(supChar)) {
//             return {
//               type: 'element',
//               tagName: 'span',
//               properties: { className: [superscript] },
//               children: [{ type: 'text', value: part.slice(1, -1) }]
//             };
//           } else if (part.startsWith(subChar) && part.endsWith(subChar)) {
//             return {
//               type: 'element',
//               tagName: 'span',
//               properties: { className: [subscript] },
//               children: [{ type: 'text', value: part.slice(1, -1) }]
//             };
//           } else {
//             return { type: 'text', value: part }
//           }
//         });
//         parent.children.splice(index, 1, ...parts)
//       }
//     });
//   };
// }
// ================================= END ALTERNATIVE CODE =============================

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
