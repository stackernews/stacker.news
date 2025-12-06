import { $createMathNode, $isMathNode } from '@/lib/lexical/nodes/formatting/math'

// mdast block math -> lexical
export const MdastMathVisitor = {
  testNode: 'math',
  visitNode ({ mdastNode, lexicalParent }) {
    const node = $createMathNode(mdastNode.value, false)
    lexicalParent.append(node)
  }
}

// mdast inline math -> lexical
export const MdastInlineMathVisitor = {
  testNode: 'inlineMath',
  visitNode ({ mdastNode, lexicalParent }) {
    const node = $createMathNode(mdastNode.value, true)
    lexicalParent.append(node)
  }
}

// lexical -> mdast
export const LexicalMathVisitor = {
  testLexicalNode: $isMathNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    const inline = lexicalNode.getInline()
    actions.appendToParent(mdastParent, {
      type: inline ? 'inlineMath' : 'math',
      value: lexicalNode.getMath()
    })
  }
}
