import { $createHeadingNode, $isHeadingNode } from '@lexical/rich-text'

// mdast -> lexical
export const MdastHeadingVisitor = {
  testNode: 'heading',
  visitNode ({ mdastNode, actions }) {
    const tag = `h${mdastNode.depth}`
    actions.addAndStepInto($createHeadingNode(tag))
  }
}

// lexical -> mdast
export const LexicalHeadingVisitor = {
  testLexicalNode: $isHeadingNode,
  visitLexicalNode ({ lexicalNode, actions }) {
    const depth = parseInt(lexicalNode.getTag().slice(1))
    actions.addAndStepInto('heading', { depth })
  }
}
