import { $createHeadingNode, $isHeadingNode } from '@lexical/rich-text'
import { $createTableOfContentsNode, $isTableOfContentsNode } from '../../nodes/content/toc'

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
