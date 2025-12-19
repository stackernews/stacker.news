import {
  $createUserMentionNode, $isUserMentionNode,
  $createTerritoryMentionNode, $isTerritoryMentionNode,
  $isItemMentionNode
} from '@/lib/lexical/nodes/decorative/mentions'
import { parseInternalLinks } from '@/lib/url'
import { $createItemMentionNode, isCustomText } from '@/lib/lexical/nodes/decorative/mentions/item'

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
    return `@${node.value.name}${node.value.path && node.value.path}`
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

export const MdastItemMentionLinkVisitor = {
  testNode: 'link',
  priority: 20,
  visitNode ({ mdastNode, actions }) {
    try {
      const { itemId, commentId, linkText } = parseInternalLinks(mdastNode.url)
      if (itemId || commentId) {
        const mentionNode = $createItemMentionNode({
          id: commentId || itemId,
          text: mdastNode.children?.[0]?.value || linkText,
          url: mdastNode.url
        })
        actions.addAndStepInto(mentionNode)
        return
      }
    } catch {}
    actions.nextVisitor()
  }
}

// item mentions are created from bare links (see link.js)
// lexical -> mdast: outputs as link if custom text, otherwise plain text URL
export const LexicalItemMentionVisitor = {
  testLexicalNode: $isItemMentionNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    const url = lexicalNode.getURL()
    const text = lexicalNode.getText()
    const id = lexicalNode.getItemMentionId()

    // check if custom text
    if (isCustomText(text, id)) {
      // export as a LinkNode
      actions.appendToParent(mdastParent, {
        type: 'link',
        url,
        children: [{ type: 'text', value: text }]
      })
    } else {
      // export as text node
      actions.appendToParent(mdastParent, {
        type: 'text',
        value: url
      })
    }
  }
}
