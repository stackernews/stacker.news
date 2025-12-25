import { $createTextNode } from 'lexical'
import {
  IS_BOLD,
  IS_CODE,
  IS_HIGHLIGHT,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT
} from '../format-constants.js'

// build html tag formatting visitors (open/close tags)
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
export const MdastStrikeThroughVisitor = {
  testNode: 'delete',
  visitNode ({ mdastNode, actions, lexicalParent }) {
    actions.addFormatting(IS_STRIKETHROUGH)
    actions.visitChildren(mdastNode, lexicalParent)
  }
}

// mdast highlight -> lexical
export const MdastHighlightVisitor = {
  testNode: 'highlight',
  visitNode ({ mdastNode, actions, lexicalParent }) {
    actions.addFormatting(IS_HIGHLIGHT)
    actions.visitChildren(mdastNode, lexicalParent)
  }
}

// mdast inline code -> lexical
export const MdastCodeVisitor = {
  testNode: 'inlineCode',
  visitNode ({ mdastNode, actions }) {
    actions.addAndStepInto($createTextNode(mdastNode.value).setFormat(actions.getParentFormatting() | IS_CODE))
  }
}

// mdast emphasis -> lexical
export const MdastEmphasisVisitor = {
  testNode: 'emphasis',
  visitNode ({ mdastNode, actions, lexicalParent }) {
    actions.addFormatting(IS_ITALIC)
    actions.visitChildren(mdastNode, lexicalParent)
  }
}

// mdast strong -> lexical
export const MdastStrongVisitor = {
  testNode: 'strong',
  visitNode ({ mdastNode, actions, lexicalParent }) {
    actions.addFormatting(IS_BOLD)
    actions.visitChildren(mdastNode, lexicalParent)
  }
}

// html fallback: plain text
export const MdastHtmlFallbackVisitor = {
  testNode: 'html',
  visitNode ({ mdastNode, lexicalParent, actions }) {
    const textNode = $createTextNode(mdastNode.value)
    textNode.setFormat(actions.getParentFormatting())
    lexicalParent.append(textNode)
  }
}

// all formatting visitors combined
// order matters: specific html tag visitors must come before the fallback
export const formattingVisitors = [
  MdastEmphasisVisitor,
  MdastStrongVisitor,
  MdastCodeVisitor,
  MdastStrikeThroughVisitor,
  MdastHighlightVisitor,
  ...buildHtmlTagVisitors('sup', IS_SUPERSCRIPT),
  ...buildHtmlTagVisitors('sub', IS_SUBSCRIPT),
  MdastHtmlFallbackVisitor
]
