import { $createParagraphNode, $isParagraphNode, $createLineBreakNode } from 'lexical'

// node types that should not wrap content in paragraphs
const lexicalTypesThatShouldSkipParagraphs = ['listitem', 'quote', 'admonition']

// mdast -> lexical
export const MdastParagraphVisitor = {
  testNode: 'paragraph',
  visitNode ({ mdastNode, lexicalParent, actions }) {
    // markdown inserts paragraphs in lists, but lexical does not need them
    if (lexicalTypesThatShouldSkipParagraphs.includes(lexicalParent.getType())) {
      // insert double line break between paragraphs to preserve separation
      if (lexicalParent.getChildrenSize() > 0) {
        lexicalParent.append($createLineBreakNode())
        lexicalParent.append($createLineBreakNode())
      }
      actions.visitChildren(mdastNode, lexicalParent)
    } else {
      actions.addAndStepInto($createParagraphNode())
    }
  }
}

// lexical -> mdast
export const LexicalParagraphVisitor = {
  testLexicalNode: $isParagraphNode,
  visitLexicalNode ({ actions }) {
    actions.addAndStepInto('paragraph')
  }
}
