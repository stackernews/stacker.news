import { findAndReplace } from 'mdast-util-find-and-replace'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import { parseInternalLinks } from '@/lib/url'
import { isImageOnlyLink } from '@/lib/lexical/mdast/shared'
import {
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_CODE,
  IS_HIGHLIGHT,
  IS_SUPERSCRIPT,
  IS_SUBSCRIPT,
  IS_UNDERLINE
} from '@/lib/lexical/mdast/format-constants'

// regexes from rehype-sn.js
const userGroup = '[\\w_]+'
const subGroup = '[A-Za-z][\\w_]+'

const USER_MENTION_PATTERN = new RegExp('\\B@(' + userGroup + '(?:\\/' + userGroup + ')?)', 'gi')
const TERRITORY_MENTION_PATTERN = new RegExp('~(' + subGroup + '(?:\\/' + subGroup + ')?)', 'gi')
const IGNORE_TYPES = ['code', 'inlineCode', 'link']

export function mentionTransform (tree) {
  findAndReplace(
    tree,
    [
      [
        USER_MENTION_PATTERN,
        (value) => {
          const [name, ...pathParts] = value.slice(1).split('/')
          return {
            type: 'userMention',
            value: {
              name,
              path: pathParts.length ? '/' + pathParts.join('/') : ''
            }
          }
        }
      ],
      [
        TERRITORY_MENTION_PATTERN,
        (value) => ({
          type: 'territoryMention',
          value: value.slice(1)
        })
      ]
    ],
    { ignore: IGNORE_TYPES }
  )
}

function getLinkFormat (node) {
  let format = 0
  function walk (n) {
    if (!n) return
    if (n.type === 'emphasis') format |= IS_ITALIC
    if (n.type === 'strong') format |= IS_BOLD
    if (n.type === 'delete') format |= IS_STRIKETHROUGH
    if (n.type === 'highlight') format |= IS_HIGHLIGHT
    if (n.type === 'inlineCode') format |= IS_CODE
    if (n.type === 'html') {
      if (n.value === '<sup>' || n.value?.includes('sup')) format |= IS_SUPERSCRIPT
      if (n.value === '<sub>' || n.value?.includes('sub')) format |= IS_SUBSCRIPT
      if (n.value === '<ins>' || n.value?.includes('ins')) format |= IS_UNDERLINE
    }
    if (n.children && Array.isArray(n.children)) {
      for (const child of n.children) {
        walk(child)
      }
    }
  }
  walk(node)
  return format
}

/** walk link nodes and replace internal item links with an itemMention node.
*
* must run before misleadingLinkTransform so we don't lose custom link text.
*/
export function itemMentionTransform (tree) {
  visit(tree, 'link', (node, index, parent) => {
    if (!node.url || !parent || index === undefined) return

    // skip if link wraps only an image
    if (isImageOnlyLink(node)) return

    try {
      const { itemId, commentId } = parseInternalLinks(node.url)
      if (itemId || commentId) {
        // bare links (text === url) carry no custom text: leave text undefined
        // non-bare links keep their custom text and round-trip as [text](url).
        const linkContent = toString(node)
        const text = linkContent && linkContent !== node.url ? linkContent : undefined
        const format = getLinkFormat(node)
        parent.children[index] = {
          type: 'itemMention',
          value: {
            id: commentId || itemId,
            text,
            url: node.url,
            format
          }
        }
      }
    } catch {
      // parseInternalLinks throws on malformed URLs; leave the link untouched
    }
  })
}
