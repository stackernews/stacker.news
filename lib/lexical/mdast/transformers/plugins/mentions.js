import { $createUserMentionNode } from '@/lib/lexical/nodes/decorative/mentions/user'
import { $createTerritoryMentionNode } from '@/lib/lexical/nodes/decorative/mentions/territory'

// micromark tokenizer for prefix-based syntax
function prefixTokenizer (prefix, pattern, typeName) {
  return function (effects, ok, nok) {
    return start
    function start (code) {
      if (code !== prefix.charCodeAt(0)) return nok(code)
      effects.enter(typeName)
      effects.consume(code)
      return content
    }
    function content (code) {
      if (code === -1 || code === null) {
        effects.exit(typeName)
        return ok(code)
      }
      if (pattern.test(String.fromCharCode(code))) {
        effects.consume(code)
        return content
      }
      effects.exit(typeName)
      return ok(code)
    }
  }
}

// micromark/mdast extensions
export const micromark = {
  text: {
    64: { tokenize: prefixTokenizer('@', /[a-zA-Z0-9_/]/, 'userMention') },
    126: { tokenize: prefixTokenizer('~', /[a-zA-Z0-9_]/, 'territoryMention') }
  }
}

export const fromMarkdown = {
  enter: {
    userMention: function (token) {
      this.enter({ type: 'userMention', value: null }, token)
    },
    territoryMention: function (token) {
      this.enter({ type: 'territoryMention', value: null }, token)
    }
  },
  exit: {
    userMention: function (token) {
      const node = this.stack[this.stack.length - 1]
      const raw = this.sliceSerialize(token).slice(1)
      const [name, ...pathParts] = raw.split('/')
      node.value = { name, path: pathParts.length ? '/' + pathParts.join('/') : '' }
      this.exit(token)
    },
    territoryMention: function (token) {
      const node = this.stack[this.stack.length - 1]
      node.value = this.sliceSerialize(token).slice(1)
      this.exit(token)
    }
  }
}

// mentions
export const USER_MENTION = {
  type: 'user-mention',
  mdastType: 'userMention',
  toMdast: (node) => ({
    type: 'userMention',
    value: { name: node.getUserMentionName(), path: node.getPath() || '' }
  }),
  fromMdast: (node) => {
    if (node.type !== 'userMention') return null
    return $createUserMentionNode({ name: node.value.name, path: node.value.path || '' })
  },
  toMarkdown: (node) => `@${node.value.name}${node.value.path || ''}`
}

export const TERRITORY_MENTION = {
  type: 'territory-mention',
  mdastType: 'territoryMention',
  toMdast: (node) => ({
    type: 'territoryMention',
    value: node.getTerritoryMentionName()
  }),
  fromMdast: (node) => {
    if (node.type !== 'territoryMention') return null
    return $createTerritoryMentionNode(node.value)
  },
  toMarkdown: (node) => `~${node.value}`
}

export default [USER_MENTION, TERRITORY_MENTION]
