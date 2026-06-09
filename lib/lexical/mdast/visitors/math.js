import { $createMathNode, $isMathNode } from '@/lib/lexical/nodes/formatting/math'

// mdast block math -> lexical
export const MdastMathVisitor = {
  testNode: 'math',
  visitNode ({ mdastNode, actions }) {
    const node = $createMathNode(mdastNode.value, false)
    actions.addAndStepInto(node)
  }
}

// mdast inline math -> lexical
export const MdastInlineMathVisitor = {
  testNode: 'inlineMath',
  visitNode ({ mdastNode, actions }) {
    const node = $createMathNode(mdastNode.value, true)
    actions.addAndStepInto(node)
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
