import {
  $createTableNode, $isTableNode,
  $createTableRowNode, $isTableRowNode,
  $createTableCellNode, $isTableCellNode
} from '@lexical/table'

// mdast -> lexical
export const MdastTableVisitor = {
  testNode: 'table',
  visitNode ({ actions }) {
    actions.addAndStepInto($createTableNode())
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
  visitNode ({ actions }) {
    actions.addAndStepInto($createTableCellNode())
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
