import { $createParagraphNode, $isParagraphNode, $createLineBreakNode } from 'lexical'

// node types that should not wrap content in paragraphs
const lexicalTypesThatShouldSkipParagraphs = ['listitem', 'quote', 'admonition']

const shouldInsertParagraphBreaks = ({ mdastParent, mdastNode }) => {
  if (!mdastParent?.children) return false
  const index = mdastParent.children.indexOf(mdastNode)
  if (index <= 0) return false
  return mdastParent.children[index - 1]?.type === 'paragraph'
}

// mdast -> lexical
export const MdastParagraphVisitor = {
  testNode: 'paragraph',
  visitNode ({ mdastNode, lexicalParent, mdastParent, actions }) {
    // markdown inserts paragraphs in lists, but lexical does not need them
    if (lexicalTypesThatShouldSkipParagraphs.includes(lexicalParent.getType())) {
      // insert double line break between paragraphs to preserve separation
      // only if the previous node is a paragraph
      if (shouldInsertParagraphBreaks({ mdastParent, mdastNode })) {
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
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    const children = lexicalNode.getChildren()

    // Handle empty paragraphs (blank lines in markdown)
    if (children.length === 0) {
      // Don't create a node for empty paragraphs
      // Instead, mark the previous paragraph to preserve the blank line
      if (mdastParent.children && mdastParent.children.length > 0) {
        const lastChild = mdastParent.children[mdastParent.children.length - 1]
        if (lastChild.type === 'paragraph') {
          lastChild.blankLineAfter = true
        }
      }
      return
    }

    actions.addAndStepInto('paragraph')
  }
}
