import { $createQuoteNode, $isQuoteNode } from '@lexical/rich-text'
import { $isLineBreakNode } from 'lexical'

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
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    const blockquote = { type: 'blockquote', children: [] }
    actions.appendToParent(mdastParent, blockquote)

    const newParagraph = () => {
      const p = { type: 'paragraph', children: [] }
      blockquote.children.push(p)
      return p
    }

    let paragraph = newParagraph()

    for (const child of lexicalNode.getChildren()) {
      if ($isLineBreakNode(child)) {
        paragraph = newParagraph()
        continue
      }
      actions.visit(child, paragraph)
    }

    // drop trailing empty paragraph
    const last = blockquote.children.at(-1)
    if (last?.children.length === 0) {
      blockquote.children.pop()
    }
  }
}
