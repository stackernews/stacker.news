import { $createTextNode, $isTextNode, $createLineBreakNode } from 'lexical'
import {
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_CODE,
  IS_HIGHLIGHT,
  IS_SUPERSCRIPT,
  IS_SUBSCRIPT
} from '../format-constants.js'

// format definitions for data-driven export
// order matters: formats are applied in this sequence
const FORMAT_DEFINITIONS = [
  { flag: IS_SUPERSCRIPT, openTag: '<sup>', closeTag: '</sup>' },
  { flag: IS_SUBSCRIPT, openTag: '<sub>', closeTag: '</sub>' },
  { flag: IS_ITALIC, mdastType: 'emphasis' },
  { flag: IS_BOLD, mdastType: 'strong' },
  { flag: IS_STRIKETHROUGH, mdastType: 'delete' },
  { flag: IS_HIGHLIGHT, mdastType: 'highlight' }
]

// helper to check if a node is mdast text
export function isMdastText (mdastNode) {
  return mdastNode.type === 'text'
}

/** some browsers insert zero-width spaces (U+200B) */
export function removeZeroWidthSpace (text) {
  return text.replace(/\u200b/g, '')
}

// mdast -> lexical
export const MdastTextVisitor = {
  testNode: 'text',
  visitNode ({ mdastNode, lexicalParent, actions }) {
    const format = actions.getParentFormatting()
    const value = removeZeroWidthSpace(mdastNode.value)

    // split on newlines and create text nodes with line breaks between them
    const parts = value.split('\n')
    parts.forEach((part, index) => {
      if (part) {
        const textNode = $createTextNode(part)
        textNode.setFormat(format)
        lexicalParent.append(textNode)
      }
      // add LineBreakNode after each part except the last
      if (index < parts.length - 1) {
        lexicalParent.append($createLineBreakNode())
      }
    })
  }
}

// lexical -> mdast
export const LexicalTextVisitor = {
  shouldJoin (prevNode, currentNode) {
    if (['text', 'emphasis', 'strong', 'delete', 'highlight'].includes(prevNode.type)) {
      return prevNode.type === currentNode.type
    }
    return false
  },

  join (prevNode, currentNode) {
    if (isMdastText(prevNode) && isMdastText(currentNode)) {
      return {
        type: 'text',
        value: prevNode.value + currentNode.value
      }
    }
    return {
      ...prevNode,
      children: [...prevNode.children, ...currentNode.children]
    }
  },

  testLexicalNode: $isTextNode,

  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    const previousSibling = lexicalNode.getPreviousSibling()
    const prevFormat = $isTextNode(previousSibling) ? previousSibling.getFormat() : 0
    const textContent = removeZeroWidthSpace(lexicalNode.getTextContent())
    const format = lexicalNode.getFormat()

    // collect html tags that need to wrap the text
    const openTags = []
    const closeTags = []

    for (const def of FORMAT_DEFINITIONS) {
      if (def.openTag && (format & def.flag)) {
        openTags.push(def.openTag)
        closeTags.unshift(def.closeTag)
      }
    }

    // add opening html tags
    for (const tag of openTags) {
      actions.appendToParent(mdastParent, { type: 'html', value: tag })
    }

    let localParentNode = mdastParent

    // apply mdast format wrappers (non-html formats)
    for (const { flag, mdastType } of FORMAT_DEFINITIONS) {
      if (!mdastType) continue
      // handle continued formatting from previous sibling
      if (prevFormat & format & flag) {
        localParentNode = actions.appendToParent(localParentNode, {
          type: mdastType,
          children: []
        })
      }
    }

    for (const { flag, mdastType } of FORMAT_DEFINITIONS) {
      if (!mdastType) continue
      // handle new formatting introduced with this node
      if (format & flag && !(prevFormat & flag)) {
        localParentNode = actions.appendToParent(localParentNode, {
          type: mdastType,
          children: []
        })
      }
    }

    // handle inline code separately (it's a leaf node, not a wrapper)
    if (format & IS_CODE) {
      actions.appendToParent(localParentNode, {
        type: 'inlineCode',
        value: textContent
      })
    } else {
      actions.appendToParent(localParentNode, {
        type: 'text',
        value: textContent
      })
    }

    // add closing html tags
    for (const tag of closeTags) {
      actions.appendToParent(mdastParent, { type: 'html', value: tag })
    }
  }
}
