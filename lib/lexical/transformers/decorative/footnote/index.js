import {
  FootnoteReferenceNode,
  FootnoteDefinitionNode,
  FootnoteListNode,
  $createFootnoteReferenceNode,
  $createFootnoteDefinitionNode,
  $isFootnoteReferenceNode,
  $isFootnoteDefinitionNode,
  $isFootnoteListNode
} from '@/lib/lexical/nodes/decorative/footnote'
import { $createParagraphNode, $createTextNode } from 'lexical'

/** Footnote reference transformer
 *
 *  rich mode: gets a footnote reference node and creates [^1]
 *
 *  markdown mode: from [^1] to footnote reference node
 *
 */
export const FOOTNOTE_REFERENCE = {
  dependencies: [FootnoteReferenceNode],
  export: (node) => {
    if (!$isFootnoteReferenceNode(node)) return null
    return `[^${node.getFootnoteId()}]`
  },
  importRegExp: /\[\^([^\]]+)\]/,
  regExp: /\[\^([^\]]+)\]/,
  replace: (textNode, match) => {
    const footnoteId = match[1]
    const footnoteNode = $createFootnoteReferenceNode(footnoteId)
    textNode.replace(footnoteNode)
  },
  trigger: '[',
  type: 'text-match'
}

/** Footnote definition transformer
 *
 *  rich mode: gets a footnote definition node and creates [^1]: content
 *
 *  markdown mode: from [^1]: content to footnote definition node
 *
 */
export const FOOTNOTE_DEFINITION = {
  dependencies: [FootnoteDefinitionNode],
  export: (node) => {
    if (!$isFootnoteDefinitionNode(node)) {
      return null
    }

    // Export children as text content
    const textContent = node.getTextContent()
    // Remove the label from the text content if it exists
    const cleanedContent = textContent.replace(/^\[\^[^\]]+\]:\s*/, '')
    return `[^${node.getFootnoteId()}]: ${cleanedContent}`
  },
  regExp: /^\[\^([^\]]+)\]:\s+(.*)$/,
  replace: (parentNode, children, match) => {
    const [fullMatch, footnoteId, content] = match

    // Create the footnote definition node
    const footnoteNode = $createFootnoteDefinitionNode(footnoteId)

    // Create a paragraph with the content
    const paragraph = $createParagraphNode()
    if (content && content.trim()) {
      const textNode = $createTextNode(content)
      paragraph.append(textNode)
    }
    footnoteNode.append(paragraph)

    // Replace the node
    parentNode.replace(footnoteNode)

    return footnoteNode
  },
  type: 'element'
}

export const FOOTNOTE_LIST = {
  dependencies: [FootnoteListNode],
  regExp: /^$/,
  replace: () => {
    return false
  },
  export: (node) => {
    if (!$isFootnoteListNode(node)) return null
    return ''
  },
  type: 'element'
}
