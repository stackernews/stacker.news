import {
  $createUserMentionNode, $isUserMentionNode,
  $createTerritoryMentionNode, $isTerritoryMentionNode,
  $isItemMentionNode
} from '@/lib/lexical/nodes/decorative/mentions'
import { parseInternalLinks } from '@/lib/url'
import { $createItemMentionNode, isCustomText } from '@/lib/lexical/nodes/decorative/mentions/item'
import {
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_HIGHLIGHT,
  IS_SUPERSCRIPT,
  IS_SUBSCRIPT,
  IS_UNDERLINE
} from '../format-constants.js'

const HTML_FORMATS = [
  { flag: IS_SUPERSCRIPT, openTag: '<sup>', closeTag: '</sup>' },
  { flag: IS_SUBSCRIPT, openTag: '<sub>', closeTag: '</sub>' },
  { flag: IS_UNDERLINE, openTag: '<ins>', closeTag: '</ins>' }
]

const MDAST_FORMATS = [
  { flag: IS_ITALIC, mdastType: 'emphasis' },
  { flag: IS_BOLD, mdastType: 'strong' },
  { flag: IS_STRIKETHROUGH, mdastType: 'delete' },
  { flag: IS_HIGHLIGHT, mdastType: 'highlight' }
]

function appendWithFormatting (node, format, mdastParent, actions) {
  if (!format) {
    actions.appendToParent(mdastParent, node)
    return
  }

  for (const { flag, openTag } of HTML_FORMATS) {
    if (format & flag) {
      actions.appendToParent(mdastParent, { type: 'html', value: openTag })
    }
  }

  let localParentNode = mdastParent
  for (const { flag, mdastType } of MDAST_FORMATS) {
    if (format & flag) {
      localParentNode = actions.appendToParent(localParentNode, {
        type: mdastType,
        children: []
      })
    }
  }

  actions.appendToParent(localParentNode, node)

  for (let i = HTML_FORMATS.length - 1; i >= 0; i--) {
    const { flag, closeTag } = HTML_FORMATS[i]
    if (format & flag) {
      actions.appendToParent(mdastParent, { type: 'html', value: closeTag })
    }
  }
}

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

// extract text by traversing the mdast node children
function extractText (children) {
  if (!children || children.length === 0) return ''

  return children.map(child => {
    if (child.type === 'text') {
      return child.value
    }

    if (child.children) {
      return extractText(child.children)
    }
    return ''
  }).join('')
}

export const MdastItemMentionLinkVisitor = {
  testNode: 'link',
  priority: 20,
  visitNode ({ mdastNode, actions }) {
    try {
      const { itemId, commentId, linkText } = parseInternalLinks(mdastNode.url)
      if (itemId || commentId) {
        const text = extractText(mdastNode.children) || linkText
        const mentionNode = $createItemMentionNode({
          id: commentId || itemId,
          text,
          url: mdastNode.url,
          format: actions.getParentFormatting()
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
    let node

    // check if custom text
    if (isCustomText(text, id)) {
      // export as a LinkNode
      node = {
        type: 'link',
        url,
        children: [{ type: 'text', value: text }]
      }
    } else {
      // export as text node
      node = {
        type: 'text',
        value: url,
        data: { url: true }
      }
    }

    appendWithFormatting(node, lexicalNode.getFormat(), mdastParent, actions)
  }
}
