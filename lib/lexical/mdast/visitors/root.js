import { $isRootNode } from 'lexical'

// mdast -> lexical
export const MdastRootVisitor = {
  testNode: 'root',
  visitNode ({ actions, mdastNode, lexicalParent }) {
    actions.visitChildren(mdastNode, lexicalParent)
  }
}

// lexical -> mdast
export const LexicalRootVisitor = {
  testLexicalNode: $isRootNode,
  visitLexicalNode ({ actions }) {
    actions.addAndStepInto('root')
  }
}
