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
  visitNode ({ mdastNode, lexicalParent, mdastParent, actions, splitInParagraphs = false }) {
    // markdown inserts paragraphs in lists, but lexical does not need them
    if (lexicalTypesThatShouldSkipParagraphs.includes(lexicalParent.getType())) {
      if (shouldInsertParagraphBreaks({ mdastParent, mdastNode })) {
        lexicalParent.append($createLineBreakNode())
        lexicalParent.append($createLineBreakNode())
      }
      actions.visitChildren(mdastNode, lexicalParent)
    } else if (splitInParagraphs) {
      // when splitInParagraphs is true, newlines in text nodes mark paragraph boundaries
      // e.g. "000\n123\n456" becomes three separate paragraphs.
      // this is useful for transformer bridge operations where we need
      // compatibility between markdown and lexical

      // if this mdast paragraph was preceded by another paragraph,
      // insert an empty paragraph to represent the blank line between them
      if (shouldInsertParagraphBreaks({ mdastParent, mdastNode })) {
        lexicalParent.append($createParagraphNode())
      }

      let paragraph = $createParagraphNode()
      lexicalParent.append(paragraph)

      for (const child of mdastNode.children) {
        const hasNewline = child.type === 'text' && child.value.includes('\n')

        if (!hasNewline) {
          // non-text nodes (links, images, etc.) or text without newlines
          // go into the current paragraph as-is
          actions.visitChildren({ type: 'paragraph', children: [child] }, paragraph)
          continue
        }

        // text node with newlines
        // each newline starts a fresh paragraph
        const lines = child.value.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) {
            paragraph = $createParagraphNode()
            lexicalParent.append(paragraph)
          }
          if (lines[i]) {
            actions.visitChildren({ type: 'paragraph', children: [{ ...child, value: lines[i] }] }, paragraph)
          }
        }
      }
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
