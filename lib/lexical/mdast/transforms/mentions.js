import { findAndReplace } from 'mdast-util-find-and-replace'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import { parseInternalLinks } from '@/lib/url'

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

/** walk link nodes and replace internal item links with an itemMention node.
*
* must run before misleadingLinkTransform so we don't lose custom link text.
*/
export function itemMentionTransform (tree) {
  visit(tree, 'link', (node, index, parent) => {
    if (!node.url || !parent || index === undefined) return
    try {
      const { itemId, commentId } = parseInternalLinks(node.url)
      if (itemId || commentId) {
        // bare links (text === url) carry no custom text: leave text undefined
        // non-bare links keep their custom text and round-trip as [text](url).
        const linkContent = toString(node)
        const text = linkContent && linkContent !== node.url ? linkContent : undefined
        parent.children[index] = {
          type: 'itemMention',
          value: {
            id: commentId || itemId,
            text,
            url: node.url
          }
        }
      }
    } catch {
      // parseInternalLinks throws on malformed URLs; leave the link untouched
    }
  })
}
