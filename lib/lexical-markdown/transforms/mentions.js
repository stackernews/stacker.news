import { visit, SKIP } from 'unist-util-visit'

const MENTION_PATTERN = /(@[a-zA-Z0-9_/]+|~[a-zA-Z0-9_]+)/g
const SKIP_TYPES = new Set(['code', 'inlineCode'])

export function createMentionTransform () {
  return function mentionTransform (tree) {
    visit(tree, 'text', (node, index, parent) => {
      // skip text inside code blocks
      if (!parent || SKIP_TYPES.has(parent.type)) return SKIP

      const parts = node.value.split(MENTION_PATTERN)
      if (parts.length === 1) return

      // user mentions and territory mentions parsing
      const newNodes = parts.filter(Boolean).map(part => {
        if (part.startsWith('@')) {
          const [name, ...pathParts] = part.slice(1).split('/')
          return {
            type: 'userMention',
            value: { name, path: pathParts.length ? '/' + pathParts.join('/') : '' }
          }
        }
        if (part.startsWith('~')) {
          return {
            type: 'territoryMention',
            value: part.slice(1)
          }
        }
        return { type: 'text', value: part }
      })

      parent.children.splice(index, 1, ...newNodes)
      return SKIP
    })
  }
}
