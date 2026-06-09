import {
  $createTableNode, $isTableNode,
  $createTableRowNode, $isTableRowNode,
  $createTableCellNode, $isTableCellNode
} from '@lexical/table'

// mdast -> lexical
export const MdastTableVisitor = {
  testNode: 'table',
  visitNode ({ mdastNode, actions }) {
    const table = $createTableNode()
    table._align = mdastNode.align // temporarily store align attribute
    actions.addAndStepInto(table)
  }
}

export const MdastTableRowVisitor = {
  testNode: 'tableRow',
  visitNode ({ actions }) {
    actions.addAndStepInto($createTableRowNode())
  }
}

export const MdastTableCellVisitor = {
  testNode: 'tableCell',
  visitNode ({ mdastNode, mdastParent, lexicalParent, actions }) {
    // we're obtaining the table node from the table row parent
    const tableNode = lexicalParent.getParent()
    // get the column index of the current cell
    const colIndex = mdastParent.children.indexOf(mdastNode)
    // get the alignment for the current column
    const align = tableNode?._align?.[colIndex]

    const cell = $createTableCellNode()
    if (align) {
      cell.setFormat(align)
    }
    actions.addAndStepInto(cell)
  }
}

// lexical -> mdast
// LOSSY: lexical stores alignments in each cell, markdown allows only column-level alignment
// because of this, we're collecting alignments only from the first row
export const LexicalTableVisitor = {
  testLexicalNode: $isTableNode,
  visitLexicalNode ({ lexicalNode, actions }) {
    // collect alignment from first row cells
    const firstRow = lexicalNode.getFirstChild()
    const align = $isTableRowNode(firstRow)
      ? firstRow.getChildren()
        .filter($isTableCellNode)
        .map(cell => cell.getFormatType() || null)
      : []

    actions.addAndStepInto('table', {
      align: align.length > 0 ? align : undefined
    })
  }
}

export const LexicalTableRowVisitor = {
  testLexicalNode: $isTableRowNode,
  visitLexicalNode ({ actions }) {
    actions.addAndStepInto('tableRow')
  }
}

export const LexicalTableCellVisitor = {
  testLexicalNode: $isTableCellNode,
  visitLexicalNode ({ actions }) {
    actions.addAndStepInto('tableCell')
  }
}
