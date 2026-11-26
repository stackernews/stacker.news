import { $createHeadingNode, $isHeadingNode } from '@lexical/rich-text'
import { visit } from 'unist-util-visit'
import { $createTableOfContentsNode, $isTableOfContentsNode } from '../../nodes/content/toc'

function normalizeLineBreaks (heading) {
  visit(heading, 'text', (text) => {
    // a blank line would end the heading, and h3 to h6 can only be one line
    text.value = text.value.replace(/\s*\n\s*/g, heading.depth > 2 ? ' ' : '\n')
  })

  // markdown can't write a line break at the start or end of a heading
  const first = heading.children.at(0)
  const last = heading.children.at(-1)
  if (first?.type === 'text') first.value = first.value.trimStart()
  if (last?.type === 'text') last.value = last.value.trimEnd()
}

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
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    const depth = parseInt(lexicalNode.getTag().slice(1))
    actions.addAndStepInto('heading', { depth })
    normalizeLineBreaks(mdastParent.children.at(-1))
  }
}

export const MdastTOCVisitor = {
  testNode: 'tableOfContents',
  visitNode ({ actions }) {
    actions.addAndStepInto($createTableOfContentsNode())
  }
}

export const LexicalTOCVisitor = {
  testLexicalNode: $isTableOfContentsNode,
  visitLexicalNode ({ lexicalNode, actions }) {
    actions.addAndStepInto('tableOfContents')
  },
  mdastType: 'tableOfContents',
  toMarkdown () {
    return '{:toc}'
  }
}
