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

    const dropTrailingEmptyParagraph = () => {
      const last = blockquote.children.at(-1)
      if (last?.type === 'paragraph' && last.children.length === 0) {
        blockquote.children.pop()
      }
    }

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
      if ($isQuoteNode(child)) {
        dropTrailingEmptyParagraph()
        actions.visit(child, blockquote)
        paragraph = newParagraph()
        continue
      }
      actions.visit(child, paragraph)
    }

    dropTrailingEmptyParagraph()
  }
}
