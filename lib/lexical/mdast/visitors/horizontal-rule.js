import { $createHorizontalRuleNode, $isHorizontalRuleNode } from '@lexical/extension'

// mdast -> lexical
export const MdastHorizontalRuleVisitor = {
  testNode: 'thematicBreak',
  visitNode ({ actions }) {
    actions.addAndStepInto($createHorizontalRuleNode())
  }
}

// lexical -> mdast
export const LexicalHorizontalRuleVisitor = {
  testLexicalNode: $isHorizontalRuleNode,
  visitLexicalNode ({ actions, mdastParent }) {
    actions.appendToParent(mdastParent, { type: 'thematicBreak' })
  }
}
