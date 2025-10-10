// ported from lexical playground
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS
} from '@lexical/markdown'
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode
} from '@lexical/table'
import {
  $isParagraphNode,
  $isTextNode
} from 'lexical'

// very primitive table setup
const TABLE_ROW_REG_EXP = /^(?:\|)(.+)(?:\|)\s?$/
const TABLE_ROW_DIVIDER_REG_EXP = /^(\| ?:?-*:? ?)+\|\s?$/

export const TABLE = {
  dependencies: [TableNode, TableRowNode, TableCellNode],
  export: node => {
    if (!$isTableNode(node)) return null

    const output = []

    for (const row of node.getChildren()) {
      const rowOutput = []
      if (!$isTableRowNode(row)) continue

      let isHeaderRow = false
      for (const cell of row.getChildren()) {
        if ($isTableCellNode(cell)) {
          // Convert the cell contents to markdown, escaping newlines
          rowOutput.push(
            $convertToMarkdownString(TRANSFORMERS, cell)
              .replace(/\n/g, '\\n')
              .trim()
          )
          if (cell.__headerState === TableCellHeaderStates.ROW) {
            isHeaderRow = true
          }
        }
      }

      output.push(`| ${rowOutput.join(' | ')} |`)
      if (isHeaderRow) {
        output.push(`| ${rowOutput.map(_ => '---').join(' | ')} |`)
      }
    }

    return output.join('\n')
  },
  regExp: TABLE_ROW_REG_EXP,
  replace: (parentNode, _1, match) => {
    // header row divider like: | --- | --- |
    if (TABLE_ROW_DIVIDER_REG_EXP.test(match[0])) {
      const table = parentNode.getPreviousSibling()
      if (!table || !$isTableNode(table)) return

      const rows = table.getChildren()
      const lastRow = rows[rows.length - 1]
      if (!lastRow || !$isTableRowNode(lastRow)) return

      // mark the last row cells as header cells
      lastRow.getChildren().forEach(cell => {
        if (!$isTableCellNode(cell)) return
        cell.setHeaderStyles(
          TableCellHeaderStates.ROW,
          TableCellHeaderStates.ROW
        )
      })

      parentNode.remove()
      return
    }

    const matchCells = mapToTableCells(match[0])
    if (matchCells == null) return

    const rows = [matchCells]
    let sibling = parentNode.getPreviousSibling()
    let maxCells = matchCells.length

    while (sibling) {
      if (!$isParagraphNode(sibling)) break
      if (sibling.getChildrenSize() !== 1) break

      const firstChild = sibling.getFirstChild()
      if (!$isTextNode(firstChild)) break

      const cells = mapToTableCells(firstChild.getTextContent())
      if (cells == null) break

      maxCells = Math.max(maxCells, cells.length)
      rows.unshift(cells)
      const previousSibling = sibling.getPreviousSibling()
      sibling.remove()
      sibling = previousSibling
    }

    const table = $createTableNode()

    for (const cells of rows) {
      const tableRow = $createTableRowNode()
      table.append(tableRow)

      for (let i = 0; i < maxCells; i++) {
        tableRow.append(i < cells.length ? cells[i] : $createTableCell(''))
      }
    }

    const previousSibling = parentNode.getPreviousSibling()
    if (
      $isTableNode(previousSibling) &&
      getTableColumnsSize(previousSibling) === maxCells
    ) {
      previousSibling.append(...table.getChildren())
      parentNode.remove()
    } else {
      parentNode.replace(table)
    }

    table.selectEnd()
  },
  type: 'element'
}

function getTableColumnsSize (table) {
  const row = table.getFirstChild()
  return $isTableRowNode(row) ? row.getChildrenSize() : 0
}

const $createTableCell = textContent => {
  const safeText = textContent.replace(/\\n/g, '\n')
  const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS)
  $convertFromMarkdownString(safeText, TRANSFORMERS, cell)
  return cell
}

const mapToTableCells = textContent => {
  const match = textContent.match(TABLE_ROW_REG_EXP)
  if (!match || !match[1]) return null
  return match[1]
    .split('|')
    .map(text => $createTableCell(text))
}
