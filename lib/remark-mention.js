import { findAndReplace } from 'mdast-util-find-and-replace'
import { visit } from 'unist-util-visit'

const userGroup = '[\\w_]+'

const mentionRegex = new RegExp(
  '@(' + userGroup + '(?:\\/' + userGroup + ')?)',
  'gi'
)
const placeholderRegex = /<!-- mention:(.+?) -->/

// Replaces mentions with placeholder (<!-- mention:username -->)
// to prevent markdown parsing
export function preprocessMentions (text) {
  if (placeholderRegex.test(text)) {
    return text
  }
  return text.replace(mentionRegex, (_, username) => `<!-- mention:${username} -->`)
}

// Rehype plugin that replaces placeholders with mention links
export function rehypeMentions () {
  return function (tree) {
    visit(tree, 'raw', function (node, index, parent) {
      if (!placeholderRegex.test(node.value)) {
        return
      }
      const usernameMatch = node.value.match(placeholderRegex)
      const username = usernameMatch[1]
      const newNode = {
        type: 'element',
        tagName: 'a',
        properties: {
          href: `/${username}`
        },
        children: [{ type: 'text', value: `@${username}` }]
      }
      if (parent) {
        parent.children[index] = newNode
      }
    })
  }
}

export default function mention (options) {
  return function transformer (tree) {
    findAndReplace(
      tree,
      [
        [mentionRegex, replaceMention]
      ],
      { ignore: ['link', 'linkReference'] }
    )
  }

  function replaceMention (value, username, match) {
    if (
      /[\w`]/.test(match.input.charAt(match.index - 1)) ||
      /[/\w`]/.test(match.input.charAt(match.index + value.length))
    ) {
      return false
    }

    const node = { type: 'text', value }

    return {
      type: 'link',
      title: null,
      url: '/' + username,
      children: [node]
    }
  }
}
