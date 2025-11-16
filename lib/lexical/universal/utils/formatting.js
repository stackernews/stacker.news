import { hasMarkdownFormat } from '@/lib/lexical/universal/commands/formatting'
import { $isElementNode } from 'lexical'
import { $isLinkNode } from '@lexical/link'
import { $findMatchingParent, $getNearestNodeOfType } from '@lexical/utils'
import { $isSNHeadingNode } from '@/lib/lexical/nodes/misc/heading'
import { $isCodeNode } from '@lexical/code'
import { normalizeCodeLanguage } from '@lexical/code-shiki'
import { $isListNode, ListNode } from '@lexical/list'
import { $findTopLevelElement, $isMarkdownMode, getSelectedNode } from './index'
import { mdParse } from '@/lib/md'

/** checks if a selection has a specific format in markdown and rich text mode
 * @param {Object} selection - lexical selection object
 * @param {string} type - format type to check for
 * @param {boolean} [isMarkdownMode] - optional pre-computed markdown mode state
 * @returns {boolean} true if selection has the format
 */
export function snHasFormat (selection, type, isMarkdownMode) {
  if (!selection) return false
  const markdownMode = isMarkdownMode !== undefined ? isMarkdownMode : $isMarkdownMode()
  return markdownMode
    ? hasMarkdownFormat(selection, type)
    : selection.hasFormat(type)
}

/** checks if a selection has a specific block type in markdown and rich text mode
 * @param {Object} selection - lexical selection object
 * @param {string} type - block type to check for
 * @param {boolean} [isMarkdownMode] - optional pre-computed markdown mode state
 * @returns {boolean} true if selection has the block type
 */
export function snHasBlockType (selection, type, isMarkdownMode) {
  if (!selection) return false
  const markdownMode = isMarkdownMode !== undefined ? isMarkdownMode : $isMarkdownMode()
  return markdownMode
    ? hasMarkdownFormat(selection, type)
    : selection.hasFormatType(type)
}

/** gets the element format of a selection in markdown and rich text mode
 * @param {Object} selection - lexical selection object
 * @param {boolean} [isMarkdownMode] - optional pre-computed markdown mode state
 * @returns {string} element format ('left', 'center', 'right', 'justify')
 */
export function snGetElementFormat (selection, isMarkdownMode) {
  if (!selection) return 'left'
  const markdownMode = isMarkdownMode !== undefined ? isMarkdownMode : $isMarkdownMode()
  if (!markdownMode) {
    const node = getSelectedNode(selection)
    const parent = node.getParent()
    let matchingParent
    if ($isLinkNode(parent)) {
      matchingParent = $findMatchingParent(node, (parentNode) => $isElementNode(parentNode) && !parentNode.isInline())
    }
    const current = $isElementNode(matchingParent)
      ? matchingParent.getFormatType()
      : $isElementNode(node)
        ? node.getFormatType()
        : parent?.getFormatType() || 'left'
    return current || 'left'
  }
  const text = selection.getTextContent().trim()
  if (text.startsWith('<div align="center">') && text.endsWith('</div>')) return 'center'
  if (text.startsWith('<div align="right">') && text.endsWith('</div>')) return 'right'
  if (text.startsWith('<div align="justify">') && text.endsWith('</div>')) return 'justify'
  return 'left'
}

/** gets the code language of a selection in markdown and rich text mode
 * @param {Object} selection - lexical selection object
 * @param {Object} editor - lexical editor instance
 * @param {boolean} [isMarkdownMode] - optional pre-computed markdown mode state
 * @returns {string} code language
 */
export function snGetCodeLanguage ({ selection, editor, isMarkdownMode }) {
  if (!selection) return ''
  const markdownMode = isMarkdownMode !== undefined ? isMarkdownMode : $isMarkdownMode()
  if (!markdownMode) {
    const anchorNode = selection.anchor.getNode()
    const element = $findTopLevelElement(anchorNode)
    const elementKey = element.getKey()
    const elementDOM = editor.getElementByKey(elementKey)
    if (elementDOM !== null) {
      if ($isCodeNode(element)) {
        const language = element.getLanguage()
        return language ? normalizeCodeLanguage(language) || language : ''
      }
    }
  }
  // a bit dumb, works only if a whole code block is selected
  // using micromark here would yield the same result
  // we could probably scan backwards to find the language on any given selection inside a code block
  const text = selection.getTextContent()
  const codeBlocks = text.split('```')
  if (codeBlocks.length > 1) {
    const language = codeBlocks[1].split('\n')[0]
    return language ? normalizeCodeLanguage(language) || language : ''
  }
  return ''
}

/** gets the block type of a selection in markdown and rich text mode
 * @param {Object} selection - lexical selection object
 * @param {Object} editor - lexical editor instance
 * @param {boolean} [isMarkdownMode] - optional pre-computed markdown mode state
 * @returns {string} block type ('paragraph', 'h1', 'bullet', 'quote', 'code')
 */
export function snGetBlockType ({ selection, editor, isMarkdownMode }) {
  if (!selection) return 'paragraph'
  const markdownMode = isMarkdownMode !== undefined ? isMarkdownMode : $isMarkdownMode()
  if (!markdownMode) {
    const anchorNode = selection.anchor.getNode()
    const element = $findTopLevelElement(anchorNode)
    const elementKey = element.getKey()
    const elementDOM = editor.getElementByKey(elementKey)
    if (elementDOM !== null) {
      if ($isListNode(element)) {
        const parentList = $getNearestNodeOfType(anchorNode, ListNode)
        const blockType = parentList ? parentList.getListType() : element.getListType()
        return blockType
      } else {
        const blockType = $isSNHeadingNode(element) ? element.getTag() : element.getType()
        return blockType || 'paragraph'
      }
    }
  }
  const text = selection.getTextContent()
  if (!text) return 'paragraph'
  const micromark = mdParse(text)
  if (micromark.has('h1') || micromark.has('h2') || micromark.has('h3')) {
    return 'h1'
  } else if (micromark.has('number') || micromark.has('bullet') || micromark.has('check')) {
    return 'bullet'
  } else if (micromark.has('quote')) {
    return 'quote'
  } else if (micromark.has('code')) {
    return 'code'
  }
}

/** checks if a selection has a link in markdown and rich text mode
 * @param {Object} selection - lexical selection object
 * @param {boolean} [isMarkdownMode] - optional pre-computed markdown mode state
 * @returns {boolean} true if selection has a link
 */
export function snHasLink (selection, isMarkdownMode) {
  if (!selection) return false
  const markdownMode = isMarkdownMode !== undefined ? isMarkdownMode : $isMarkdownMode()
  if (markdownMode) {
    return mdParse(selection.getTextContent()).has('link')
  }

  const node = getSelectedNode(selection)
  const parent = node.getParent()

  if ($isLinkNode(parent) || $isLinkNode(node)) {
    return true
  }
  return false
}
