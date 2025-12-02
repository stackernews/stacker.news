import { $createLineBreakNode, $isLineBreakNode } from 'lexical'

// mdast -> lexical
export const MdastBreakVisitor = {
  testNode: 'break',
  visitNode ({ actions }) {
    actions.addAndStepInto($createLineBreakNode())
  }
}

// lexical -> mdast
export const LexicalLinebreakVisitor = {
  testLexicalNode: $isLineBreakNode,
  visitLexicalNode ({ mdastParent, actions }) {
    actions.appendToParent(mdastParent, { type: 'text', value: '\n' })
  }
}
