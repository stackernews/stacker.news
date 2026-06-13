import {
  $createUserMentionNode, $isUserMentionNode,
  $createTerritoryMentionNode, $isTerritoryMentionNode,
  $isItemMentionNode
} from '@/lib/lexical/nodes/decorative/mentions'
import { parseInternalLinks } from '@/lib/url'
import { $createItemMentionNode, isCustomText } from '@/lib/lexical/nodes/decorative/mentions/item'
import { formatTextAsMdastChildren } from '@/lib/lexical/mdast/format'
import {
  IS_BOLD,
  IS_CODE,
  IS_HIGHLIGHT,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_UNDERLINE
} from '@/lib/lexical/mdast/format-constants'

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

const MDAST_NODE_FORMATS = {
  emphasis: IS_ITALIC,
  strong: IS_BOLD,
  delete: IS_STRIKETHROUGH,
  highlight: IS_HIGHLIGHT
}

const MDAST_HTML_FORMATS = {
  '<sup>': { flag: IS_SUPERSCRIPT, enabled: true },
  '</sup>': { flag: IS_SUPERSCRIPT, enabled: false },
  '<sub>': { flag: IS_SUBSCRIPT, enabled: true },
  '</sub>': { flag: IS_SUBSCRIPT, enabled: false },
  '<ins>': { flag: IS_UNDERLINE, enabled: true },
  '</ins>': { flag: IS_UNDERLINE, enabled: false }
}

// extract text and any format common to all text leaves in the link label
function extractTextAndFormat (children, baseFormat = 0) {
  let text = ''
  let commonFormat = null

  function appendText (value, format) {
    if (!value) return
    text += value
    commonFormat = commonFormat === null ? format : commonFormat & format
  }

  function visitChildren (children, format) {
    let activeFormat = format
    for (const child of children) {
      const htmlFormat = child.type === 'html' ? MDAST_HTML_FORMATS[child.value] : null
      if (htmlFormat) {
        activeFormat = htmlFormat.enabled
          ? activeFormat | htmlFormat.flag
          : activeFormat & ~htmlFormat.flag
        continue
      }

      visitChild(child, activeFormat)
    }
  }

  function visitChild (child, format) {
    if (child.type === 'text') {
      appendText(child.value, format)
      return
    }

    if (child.type === 'inlineCode') {
      appendText(child.value, format | IS_CODE)
      return
    }

    const childFormat = MDAST_NODE_FORMATS[child.type] || 0
    if (child.children) {
      visitChildren(child.children, format | childFormat)
    }
  }

  visitChildren(children || [], baseFormat)

  return {
    text,
    format: commonFormat ?? baseFormat
  }
}

export const MdastItemMentionLinkVisitor = {
  testNode: 'link',
  priority: 20,
  visitNode ({ mdastNode, actions }) {
    try {
      const { itemId, commentId, linkText } = parseInternalLinks(mdastNode.url)
      if (itemId || commentId) {
        const { text, format } = extractTextAndFormat(mdastNode.children, actions.getParentFormatting())
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
      // export as a LinkNode
      actions.appendToParent(mdastParent, {
        type: 'link',
        url,
        children: formatTextAsMdastChildren(text, format)
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
