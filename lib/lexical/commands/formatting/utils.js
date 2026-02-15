import { $findTopLevelElement, getSelectedNode } from '@/lib/lexical/commands/utils'
import { $findMatchingParent, $getNearestNodeOfType } from '@lexical/utils'
import { $isListNode, ListNode } from '@lexical/list'
import { $isLinkNode } from '@lexical/link'
import { $isHeadingNode } from '@lexical/rich-text'
import { $getSelection, $isRangeSelection, $isElementNode } from 'lexical'

/** checks if a selection has a link in markdown and rich text mode
 * @param {Object} selection - lexical selection object
 * @returns {boolean} true if selection has a link
 */
export function $snHasLink (selection) {
  if (!selection) return false

  const node = getSelectedNode(selection)
  const parent = node.getParent()

  if ($isLinkNode(parent) || $isLinkNode(node)) {
    return true
  }
  return false
}

/** gets the element format of a selection in markdown and rich text mode
 * @param {Object} selection - lexical selection object
 * @returns {string} element format ('left', 'center', 'right', 'justify')
 */
export function $snGetElementFormat (selection) {
  if (!selection) return 'left'
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

/**
 * gets the block type of the current selection
 * @param {Object} selection - lexical selection
 * @returns {string} block type
 */
export function $snGetBlockType (selection) {
  let blockType = 'paragraph'
  selection = selection || $getSelection()
  if (!selection) return blockType

  // handle range selection
  if ($isRangeSelection(selection)) {
    const anchorNode = selection.anchor.getNode()
    const element = $findTopLevelElement(anchorNode)
    if ($isListNode(element)) {
      const parentList = $getNearestNodeOfType(anchorNode, ListNode)
      blockType = parentList ? parentList.getListType() : element.getListType()
    } else {
      blockType = $isHeadingNode(element) ? element.getTag() : element.getType()
    }
    return blockType
  }

  // handle node selection
  const nodes = selection.getNodes()
  if (nodes.length === 0) return blockType

  for (const selectedNode of nodes) {
    const parentList = $getNearestNodeOfType(selectedNode, ListNode)
    // list nodes recognition
    if (parentList) {
      blockType = parentList.getListType()
    } else {
      const selectedElement = $findTopLevelElement(selectedNode)
      // heading nodes special case before checking for element type
      const type = $isHeadingNode(selectedElement)
        ? selectedElement.getTag()
        : selectedElement.getType()
      blockType = type || 'paragraph'
    }
  }

  return blockType
}
