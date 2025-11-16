import { $getSelection, $isRangeSelection, $isTextNode, $isElementNode } from 'lexical'
import { $isTableSelection, $getNodeTriplet } from '@lexical/table'

/** checks if a cell selection can be unmerged
 * @param {Object} [selection] - optional lexical selection (defaults to current selection)
 * @returns {boolean} true if selection can be unmerged
 */
export function $canUnmerge (selection) {
  if (!selection) {
    selection = $getSelection()
  }
  if (
    ($isRangeSelection(selection) && !selection.isCollapsed()) ||
    ($isTableSelection(selection) && !selection.anchor.is(selection.focus)) ||
    (!$isRangeSelection(selection) && !$isTableSelection(selection))
  ) {
    return false
  }
  const [cell] = $getNodeTriplet(selection.anchor)
  return cell.__colSpan > 1 || cell.__rowSpan > 1
}

/** selects the last descendant of a node
 * @param {Object} node - lexical node
 */
export function $selectLastDescendant (node) {
  const lastDescendant = node.getLastDescendant()
  if ($isTextNode(lastDescendant)) {
    lastDescendant.select()
  } else if ($isElementNode(lastDescendant)) {
    lastDescendant.selectEnd()
  } else if (lastDescendant !== null) {
    lastDescendant.selectNext()
  }
}
