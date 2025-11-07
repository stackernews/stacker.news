import { createCommand, COMMAND_PRIORITY_EDITOR, $getSelection, $isRangeSelection } from 'lexical'
import { $isMarkdownMode } from '@/lib/lexical/universal/utils'
import { INSERT_TABLE_COMMAND, $getTableNodeFromLexicalNodeOrThrow, $deleteTableColumnAtSelection, $deleteTableRowAtSelection, $insertTableRowAtSelection, $insertTableColumnAtSelection, $isTableCellNode, $mergeCells, $isTableSelection, $unmergeCell, $computeTableMapSkipCellCheck, $getTableRowIndexFromTableCellNode, $getTableColumnIndexFromTableCellNode, TableCellHeaderStates, $getTableCellNodeFromLexicalNode } from '@lexical/table'
import { $selectLastDescendant, $canUnmerge } from '@/lib/lexical/universal/utils/table'

/** command to insert a new table
 * @param {number} columns - number of columns
 * @param {number} rows - number of rows
 * @returns {boolean} true if command was handled
 */
export const SN_INSERT_TABLE_COMMAND = createCommand('SN_INSERT_TABLE_COMMAND')

/** command to delete table rows, columns, or entire table
 * @param {string} type - type of deletion ('row', 'column', 'table')
 * @param {Object} tableCellNode - table cell node to delete
 * @returns {boolean} true if command was handled
 */
export const SN_TABLE_DELETE_COMMAND = createCommand('SN_TABLE_DELETE_COMMAND')

/** command to insert table rows or columns
 * @param {string} type - type of insertion ('row', 'column')
 * @param {Object} selectionCounts - selection counts
 * @param {boolean} shouldInsertAfter - whether to insert after the selection
 * @returns {boolean} true if command was handled
 */
export const SN_TABLE_INSERT_COMMAND = createCommand('SN_TABLE_INSERT_COMMAND')

/** command to merge or unmerge table cells
 * @param {Object} selectionCounts - selection counts
 * @returns {boolean} true if command was handled
 */
export const SN_TABLE_MERGE_TOGGLE_COMMAND = createCommand('SN_TABLE_MERGE_TOGGLE_COMMAND')

/** command to toggle table cell header styles (row/column)
 * @param {string} type - type of header ('row', 'column')
 * @param {Object} tableCellNode - table cell node to toggle
 * @returns {boolean} true if command was handled
 */
export const SN_TABLE_HEADER_TOGGLE_COMMAND = createCommand('SN_TABLE_HEADER_TOGGLE_COMMAND')

/**
 * gets the table cell node from current selection
 * @returns {Object|null} table cell node or null if not in table
 */
export function $getTableCellFromSelection () {
  const selection = $getSelection()

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
 * registers command to insert a new table
 * @param {Object} params.editor - lexical editor instance
 * @returns {Function} unregister function
 */
export function registerSNInsertTableCommand ({ editor }) {
  return editor.registerCommand(SN_INSERT_TABLE_COMMAND, ({ columns = 5, rows = 3 } = {}) => {
    if ($isMarkdownMode()) return false

    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return false
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns, rows })
    return true
  }, COMMAND_PRIORITY_EDITOR)
}

/**
 * registers command to delete table rows, columns, or entire table
 * @param {Object} params.editor - lexical editor instance
 * @returns {Function} unregister function
 */
export function registerSNTableDeleteCommand ({ editor }) {
  return editor.registerCommand(SN_TABLE_DELETE_COMMAND, ({ type, tableCellNode }) => {
    if ($isMarkdownMode()) return false

    if (!tableCellNode) {
      tableCellNode = $getTableCellFromSelection()
    }

    if (!tableCellNode) return false

    switch (type) {
      case 'column':
        $deleteTableColumnAtSelection()
        break
      case 'row':
        $deleteTableRowAtSelection()
        break
      case 'table':
        $getTableNodeFromLexicalNodeOrThrow(tableCellNode)?.remove()
        break
      default:
        return false
    }
    return true
  }, COMMAND_PRIORITY_EDITOR)
}

/**
 * registers command to insert table rows or columns
 * @param {Object} params.editor - lexical editor instance
 * @returns {Function} unregister function
 */
export function registerSNTableInsertCommand ({ editor }) {
  return editor.registerCommand(SN_TABLE_INSERT_COMMAND, ({ type, selectionCounts, shouldInsertAfter = false }) => {
    if ($isMarkdownMode()) return false

    const tableCellNode = $getTableCellFromSelection()
    if (!tableCellNode) return false

    switch (type) {
      case 'row':
        for (let i = 0; i < selectionCounts.rows; i++) {
          $insertTableRowAtSelection(shouldInsertAfter)
        }
        break
      case 'column':
        for (let i = 0; i < selectionCounts.columns; i++) {
          $insertTableColumnAtSelection(shouldInsertAfter)
        }
        break
    }
    return true
  }, COMMAND_PRIORITY_EDITOR)
}

/**
 * registers command to merge or unmerge table cells
 * @param {Object} params.editor - lexical editor instance
 * @returns {Function} unregister function
 */
export function registerSNTableMergeToggleCommand ({ editor }) {
  return editor.registerCommand(SN_TABLE_MERGE_TOGGLE_COMMAND, (selectionCounts) => {
    if ($isMarkdownMode()) return false

    const selection = $getSelection()

    if ($isTableSelection(selection) && (selectionCounts?.columns > 1 || selectionCounts?.rows > 1)) {
      const nodes = selection.getNodes()
      const tableCells = nodes.filter($isTableCellNode)
      const targetCell = $mergeCells(tableCells)
      if (targetCell) {
        $selectLastDescendant(targetCell)
      }
      return true
    }

    if ($canUnmerge()) {
      $unmergeCell()
      return true
    }

    return false
  }, COMMAND_PRIORITY_EDITOR)
}

/**
 * registers command to toggle table cell header styles (row/column)
 * @param {Object} params.editor - lexical editor instance
 * @returns {Function} unregister function
 */
export function registerSNTableHeaderToggleCommand ({ editor }) {
  return editor.registerCommand(SN_TABLE_HEADER_TOGGLE_COMMAND, ({ type, tableCellNode }) => {
    if ($isMarkdownMode()) return false

    if (!tableCellNode) {
      tableCellNode = $getTableCellFromSelection()
    }

    if (!tableCellNode) return false

    const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode)
    const [gridMap] = $computeTableMapSkipCellCheck(tableNode, null, null)

    if (type === 'row') {
      const tableRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode)
      const rowCells = new Set()
      const newStyle = tableCellNode.getHeaderStyles() ^ TableCellHeaderStates.ROW

      for (let col = 0; col < gridMap[tableRowIndex].length; col++) {
        const mapCell = gridMap[tableRowIndex][col]

        if (!mapCell?.cell) {
          continue
        }

        if (!rowCells.has(mapCell.cell)) {
          rowCells.add(mapCell.cell)
          mapCell.cell.setHeaderStyles(newStyle, TableCellHeaderStates.ROW)
        }
      }
    } else if (type === 'column') {
      const tableColumnIndex = $getTableColumnIndexFromTableCellNode(tableCellNode)
      const columnCells = new Set()
      const newStyle = tableCellNode.getHeaderStyles() ^ TableCellHeaderStates.COLUMN

      for (let row = 0; row < gridMap.length; row++) {
        const mapCell = gridMap[row][tableColumnIndex]

        if (!mapCell?.cell) {
          continue
        }

        if (!columnCells.has(mapCell.cell)) {
          columnCells.add(mapCell.cell)
          mapCell.cell.setHeaderStyles(newStyle, TableCellHeaderStates.COLUMN)
        }
      }
    }

    return true
  }, COMMAND_PRIORITY_EDITOR)
}
