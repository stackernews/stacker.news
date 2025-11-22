import { $getSelection, $isRangeSelection, $isTextNode, $isElementNode } from 'lexical'
import { $isTableSelection, $getNodeTriplet, $getTableCellNodeFromLexicalNode, $isTableCellNode } from '@lexical/table'

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

/**
 * gets the table cell node from current selection
 * @param {Object} [selection] - optional lexical selection (defaults to current selection)
 * @returns {Object|null} table cell node or null if not in table
 */
export function $getTableCellFromSelection (selection) {
  if (!selection) {
    selection = $getSelection()
  }

  if ($isRangeSelection(selection)) {
    // when cursor is in a single cell
    return $getTableCellNodeFromLexicalNode(selection.anchor.getNode())
  }

  if ($isTableSelection(selection)) {
    // when multiple cells are selected
    const anchorNode = $getTableCellNodeFromLexicalNode(selection.anchor.getNode())
    if ($isTableCellNode(anchorNode)) {
      return anchorNode
    }
  }

  return null
}

/**
 * gets the table context from a selection
 * @param {Object} selection - lexical selection
 * @returns {Object} table context
 */
export function $getTableContextFromSelection (selection) {
  if (!selection) {
    selection = $getSelection()
  }
  const cell = $getTableCellFromSelection(selection)
  if (!cell) return null

  const isTableSelection = $isTableSelection(selection)
  const selectionCounts = isTableSelection
    ? computeSelectionCount(selection)
    : { rows: 1, columns: 1 }

  return { cell, selectionCounts, isTableSelection }
}

/**
 * computes the selection count for a table selection
 * @param {Object} selection - lexical selection
 * @returns {Object} selection counts
 */
export function computeSelectionCount (selection) {
  const selectionShape = selection.getShape()
  return {
    columns: selectionShape.toX - selectionShape.fromX + 1,
    rows: selectionShape.toY - selectionShape.fromY + 1
  }
}
