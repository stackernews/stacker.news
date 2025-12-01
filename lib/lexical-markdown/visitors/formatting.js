import { $createTextNode } from 'lexical'
import {
  IS_BOLD,
  IS_CODE,
  IS_HIGHLIGHT,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT
} from '../FormatConstants.js'

// helper to build html tag formatting visitors (open/close tags)
function buildHtmlTagVisitors (tag, format) {
  return [
    {
      testNode: (node) => node.type === 'html' && node.value === `<${tag}>`,
      visitNode ({ actions, mdastParent }) {
        actions.addFormatting(format, mdastParent)
      }
    },
    {
      testNode: (node) => node.type === 'html' && node.value === `</${tag}>`,
      visitNode ({ actions, mdastParent }) {
        actions.removeFormatting(format, mdastParent)
      }
    }
  ]
}

// mdast strikethrough -> lexical
export const MdStrikeThroughVisitor = {
  testNode: 'delete',
  visitNode ({ mdastNode, actions, lexicalParent }) {
    actions.addFormatting(IS_STRIKETHROUGH)
    actions.visitChildren(mdastNode, lexicalParent)
  }
}

// mdast highlight -> lexical
export const MdHighlightVisitor = {
  testNode: 'highlight',
  visitNode ({ mdastNode, actions, lexicalParent }) {
    actions.addFormatting(IS_HIGHLIGHT)
    actions.visitChildren(mdastNode, lexicalParent)
  }
}

// mdast inline code -> lexical
export const MdCodeVisitor = {
  testNode: 'inlineCode',
  visitNode ({ mdastNode, actions }) {
    actions.addAndStepInto($createTextNode(mdastNode.value).setFormat(actions.getParentFormatting() | IS_CODE))
  }
}

// mdast emphasis -> lexical
export const MdEmphasisVisitor = {
  testNode: 'emphasis',
  visitNode ({ mdastNode, actions, lexicalParent }) {
    actions.addFormatting(IS_ITALIC)
    actions.visitChildren(mdastNode, lexicalParent)
  }
}

// mdast strong -> lexical
export const MdStrongVisitor = {
  testNode: 'strong',
  visitNode ({ mdastNode, actions, lexicalParent }) {
    actions.addFormatting(IS_BOLD)
    actions.visitChildren(mdastNode, lexicalParent)
  }
}

// all formatting visitors combined
export const formattingVisitors = [
  MdEmphasisVisitor,
  MdStrongVisitor,
  MdCodeVisitor,
  MdStrikeThroughVisitor,
  MdHighlightVisitor,
  ...buildHtmlTagVisitors('sup', IS_SUPERSCRIPT),
  ...buildHtmlTagVisitors('sub', IS_SUBSCRIPT)
]
