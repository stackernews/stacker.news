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
      console.log('cell', cell)
    }
    actions.addAndStepInto(cell)
  }
}

// lexical -> mdast
export const LexicalTableVisitor = {
  testLexicalNode: $isTableNode,
  visitLexicalNode ({ actions }) {
    actions.addAndStepInto('table')
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
