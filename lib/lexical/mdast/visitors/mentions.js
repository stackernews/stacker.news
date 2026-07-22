import {
  $createUserMentionNode, $isUserMentionNode,
  $createTerritoryMentionNode, $isTerritoryMentionNode,
  $isItemMentionNode
} from '@/lib/lexical/nodes/decorative/mentions'
import { $createItemMentionNode, isCustomText } from '@/lib/lexical/nodes/decorative/mentions/item'
import { IS_BOLD, IS_HIGHLIGHT, IS_ITALIC, IS_STRIKETHROUGH } from '../format-constants'

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
    const node = $createItemMentionNode({
      id: mdastNode.value.id,
      text: mdastNode.value.text,
      url: mdastNode.value.url,
      format: mdastNode.value.format
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
    const format = lexicalNode.getFormat()

    // check if custom text
    if (isCustomText(text, id)) {
      // export as a LinkNode
      let node = {
        type: 'link',
        url,
        children: [{ type: 'text', value: text }]
      }
      for (const [flag, type] of [
        [IS_BOLD, 'strong'],
        [IS_ITALIC, 'emphasis'],
        [IS_STRIKETHROUGH, 'delete'],
        [IS_HIGHLIGHT, 'highlight']
      ]) {
        if (format & flag) node = { type, children: [node] }
      }
      actions.appendToParent(mdastParent, node)
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
