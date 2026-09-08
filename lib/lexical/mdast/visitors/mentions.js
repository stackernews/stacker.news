import {
  $createUserMentionNode, $isUserMentionNode,
  $createTerritoryMentionNode, $isTerritoryMentionNode,
  $isItemMentionNode
} from '@/lib/lexical/nodes/decorative/mentions'
import { $createItemMentionNode, isCustomText } from '@/lib/lexical/nodes/decorative/mentions/item'
import {
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_CODE,
  IS_HIGHLIGHT
} from '../format-constants.js'

// user mentions (@user, @user/path)
// uses transforms to parse mentions

// mdast -> lexical
export const MdastUserMentionVisitor = {
  testNode: 'userMention',
  visitNode ({ mdastNode, actions }) {
    const node = $createUserMentionNode({
      name: mdastNode.value.name,
      path: mdastNode.value.path || ''
    })
    actions.addAndStepInto(node)
  }
}

// lexical -> mdast
export const LexicalUserMentionVisitor = {
  testLexicalNode: $isUserMentionNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    actions.appendToParent(mdastParent, {
      type: 'userMention',
      value: {
        name: lexicalNode.getUserMentionName(),
        path: lexicalNode.getPath() || ''
      }
    })
  },
  mdastType: 'userMention',
  toMarkdown (node) {
    return `@${node.value.name}${node.value.path || ''}`
  }
}

// territory mentions (~territory)
// uses transforms to parse mentions

// mdast -> lexical
export const MdastTerritoryMentionVisitor = {
  testNode: 'territoryMention',
  visitNode ({ mdastNode, actions }) {
    const node = $createTerritoryMentionNode({ name: mdastNode.value })
    actions.addAndStepInto(node)
  }
}

// lexical -> mdast
export const LexicalTerritoryMentionVisitor = {
  testLexicalNode: $isTerritoryMentionNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    actions.appendToParent(mdastParent, {
      type: 'territoryMention',
      value: lexicalNode.getName()
    })
  },
  mdastType: 'territoryMention',
  toMarkdown (node) {
    return `~${node.value}`
  }
}

export const MdastItemMentionVisitor = {
  testNode: 'itemMention',
  visitNode ({ mdastNode, actions }) {
    const format = (mdastNode.value.format || 0) | actions.getParentFormatting()
    const node = $createItemMentionNode({
      id: mdastNode.value.id,
      text: mdastNode.value.text,
      url: mdastNode.value.url,
      format
    })
    actions.addAndStepInto(node)
  }
}

// lexical -> mdast: outputs as link if custom text, otherwise plain text URL
export const LexicalItemMentionVisitor = {
  testLexicalNode: $isItemMentionNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    const url = lexicalNode.getURL()
    const text = lexicalNode.getText()
    const id = lexicalNode.getItemMentionId()
    const format = lexicalNode.getFormat() || 0

    // check if custom text
    if (isCustomText(text, id)) {
      // export as a LinkNode
      let contentNode = { type: 'text', value: text }
      if (format & IS_CODE) {
        contentNode = { type: 'inlineCode', value: text }
      }

      let wrapper = contentNode
      if (format & IS_HIGHLIGHT) wrapper = { type: 'highlight', children: [wrapper] }
      if (format & IS_STRIKETHROUGH) wrapper = { type: 'delete', children: [wrapper] }
      if (format & IS_BOLD) wrapper = { type: 'strong', children: [wrapper] }
      if (format & IS_ITALIC) wrapper = { type: 'emphasis', children: [wrapper] }

      actions.appendToParent(mdastParent, {
        type: 'link',
        url,
        children: [wrapper]
      })
    } else {
      // export as text node
      actions.appendToParent(mdastParent, {
        type: 'text',
        value: url,
        data: { url: true }
      })
    }
  }
}
