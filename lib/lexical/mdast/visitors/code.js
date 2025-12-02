import { $createCodeNode, $isCodeNode } from '@lexical/code'
import { $createTextNode } from 'lexical'

// mdast -> lexical
export const MdastCodeBlockVisitor = {
  testNode: 'code',
  visitNode ({ mdastNode, actions }) {
    const codeNode = $createCodeNode(mdastNode.lang || undefined)
    // code blocks don't have children in mdast: the value is the content
    codeNode.append($createTextNode(mdastNode.value))
    actions.addAndStepInto(codeNode)
  }
}

// lexical -> mdast
export const LexicalCodeBlockVisitor = {
  testLexicalNode: $isCodeNode,
  visitLexicalNode ({ lexicalNode, actions, mdastParent }) {
    actions.appendToParent(mdastParent, {
      type: 'code',
      lang: lexicalNode.getLanguage() || null,
      value: lexicalNode.getTextContent()
    })
  }
}
