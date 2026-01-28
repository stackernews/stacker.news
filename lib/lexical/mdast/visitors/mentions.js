import {
  $createUserMentionNode, $isUserMentionNode,
  $createTerritoryMentionNode, $isTerritoryMentionNode,
  $isItemMentionNode
} from '@/lib/lexical/nodes/decorative/mentions'
import { parseInternalLinks } from '@/lib/url'
import { $createItemMentionNode, isCustomText } from '@/lib/lexical/nodes/decorative/mentions/item'
import { IS_BOLD, IS_ITALIC, IS_STRIKETHROUGH } from '@/lib/lexical/mdast/format-constants'

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

// extract text by traversing the mdast node children
function extractText (children, format = 0) {
  if (!children || children.length === 0) return { text: '', format }

  let text = ''

  for (const child of children) {
    if (child.type === 'text') {
      text += child.value
    } else if (child.type === 'emphasis') {
      const result = extractText(child.children, format | IS_ITALIC)
      text += result.text
      format |= result.format
    } else if (child.type === 'strong') {
      const result = extractText(child.children, format | IS_BOLD)
      text += result.text
      format |= result.format
    } else if (child.type === 'delete') {
      const result = extractText(child.children, format | IS_STRIKETHROUGH)
      text += result.text
      format |= result.format
    } else if (child.children) {
      const result = extractText(child.children, format)
      text += result.text
      format |= result.format
    }
  }

  return { text, format }
}

export const MdastItemMentionLinkVisitor = {
  testNode: 'link',
  priority: 20,
  visitNode ({ mdastNode, actions }) {
    try {
      const { itemId, commentId, linkText } = parseInternalLinks(mdastNode.url)
      if (itemId || commentId) {
        const { text, format } = extractText(mdastNode.children)
        const mentionNode = $createItemMentionNode({
          id: commentId || itemId,
          text: text || linkText,
          url: mdastNode.url,
          format
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
    const format = lexicalNode.getFormat()

    // check if custom text
    if (isCustomText(text, id)) {
      let textNode = { type: 'text', value: text }
      if (format & IS_STRIKETHROUGH) {
        textNode = { type: 'delete', children: [textNode] }
      }
      if (format & IS_ITALIC) {
        textNode = { type: 'emphasis', children: [textNode] }
      }
      if (format & IS_BOLD) {
        textNode = { type: 'strong', children: [textNode] }
      }
      // export as a LinkNode
      actions.appendToParent(mdastParent, {
        type: 'link',
        url,
        children: [textNode]
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
