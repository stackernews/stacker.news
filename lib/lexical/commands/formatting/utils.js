import { $findTopLevelElement } from '@/lib/lexical/commands/utils'
import { $getNearestNodeOfType } from '@lexical/utils'
import { $isListNode, ListNode } from '@lexical/list'
import { $isHeadingNode } from '@lexical/rich-text'
import { $getSelection } from 'lexical'

/**
 * gets the block type of the current selection
 * @param {Object} editor - lexical editor
 * @returns {string} block type
 */
export function $snGetBlockType (editor, selection) {
  selection = selection || $getSelection()
  if (!selection) return 'paragraph'

  const anchorNode = selection.anchor.getNode()
  const element = $findTopLevelElement(anchorNode)
  if ($isListNode(element)) {
    const parentList = $getNearestNodeOfType(anchorNode, ListNode)
    const blockType = parentList ? parentList.getListType() : element.getListType()
    return blockType
  } else {
    const blockType = $isHeadingNode(element) ? element.getTag() : element.getType()
    return blockType || 'paragraph'
  }
}
