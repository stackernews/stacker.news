import { $createQuoteNode, $isQuoteNode } from '@lexical/rich-text'

// mdast -> lexical
export const MdastQuoteVisitor = {
  testNode: 'blockquote',
  visitNode ({ actions }) {
    actions.addAndStepInto($createQuoteNode())
  }
}

// lexical -> mdast
export const LexicalQuoteVisitor = {
  testLexicalNode: $isQuoteNode,
  visitLexicalNode ({ actions }) {
    actions.addAndStepInto('blockquote')
  }
}
