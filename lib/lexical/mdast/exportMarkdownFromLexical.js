import { $isElementNode } from 'lexical'
import { toMarkdown } from 'mdast-util-to-markdown'

function isParent (node) {
  return node.children instanceof Array
}

// convert a lexical tree to an mdast tree
export function exportLexicalTreeToMdast ({
  root,
  visitors
}) {
  let unistRoot = null

  visitors = visitors.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  visit(root, null)

  function appendToParent (parentNode, node) {
    if (unistRoot === null) {
      unistRoot = node
      return unistRoot
    }

    if (!isParent(parentNode)) {
      throw new Error('Attempting to append children to a non-parent')
    }

    const siblings = parentNode.children
    const prevSibling = siblings.at(-1)

    if (prevSibling) {
      const joinVisitor = visitors.find((visitor) => visitor.shouldJoin?.(prevSibling, node))
      if (joinVisitor) {
        const joinedNode = joinVisitor.join(prevSibling, node)
        siblings.splice(siblings.length - 1, 1, joinedNode)
        return joinedNode
      }
    }

    siblings.push(node)
    return node
  }

  function visitChildren (lexicalNode, parentNode) {
    lexicalNode.getChildren().forEach((lexicalChild) => {
      visit(lexicalChild, parentNode)
    })
  }

  function visit (lexicalNode, mdastParent, usedVisitors = null) {
    const visitor = visitors.find((visitor, index) => {
      if (usedVisitors?.has(index)) {
        return false
      }
      return visitor.testLexicalNode?.(lexicalNode)
    })

    if (!visitor) {
      throw new Error(`no lexical visitor found for ${lexicalNode.getType()}`, {
        cause: lexicalNode
      })
    }

    visitor.visitLexicalNode?.({
      lexicalNode,
      mdastParent,
      actions: {
        addAndStepInto (type, props = {}, hasChildren = true) {
          const newNode = {
            type,
            ...props,
            ...(hasChildren ? { children: [] } : {})
          }
          appendToParent(mdastParent, newNode)
          if ($isElementNode(lexicalNode) && hasChildren) {
            visitChildren(lexicalNode, newNode)
          }
        },
        appendToParent,
        visitChildren,
        visit,
        nextVisitor () {
          visit(lexicalNode, mdastParent, (usedVisitors ?? new Set()).add(visitors.indexOf(visitor)))
        }
      }
    })
  }

  if (unistRoot === null) {
    throw new Error('traversal ended with no root element')
  }

  fixWrappingWhitespace(unistRoot, [])

  return unistRoot
}

const TRAILING_WHITESPACE_REGEXP = /\s+$/
const LEADING_WHITESPACE_REGEXP = /^\s+/

function fixWrappingWhitespace (node, parentChain) {
  if (node.type === 'strong' || node.type === 'emphasis') {
    const lastChild = node.children.at(-1)
    if (lastChild?.type === 'text') {
      const trailingWhitespace = lastChild.value.match(TRAILING_WHITESPACE_REGEXP)
      if (trailingWhitespace) {
        lastChild.value = lastChild.value.replace(TRAILING_WHITESPACE_REGEXP, '')
        const parent = parentChain.at(-1)
        if (parent) {
          parent.children.splice(parent.children.indexOf(node) + 1, 0, {
            type: 'text',
            value: trailingWhitespace[0]
          })
          fixWrappingWhitespace(parent, parentChain.slice(0, -1))
        }
      }
    }
    const firstChild = node.children.at(0)
    if (firstChild?.type === 'text') {
      const leadingWhitespace = firstChild.value.match(LEADING_WHITESPACE_REGEXP)
      if (leadingWhitespace) {
        firstChild.value = firstChild.value.replace(LEADING_WHITESPACE_REGEXP, '')
        const parent = parentChain.at(-1)
        if (parent) {
          parent.children.splice(parent.children.indexOf(node), 0, {
            type: 'text',
            value: leadingWhitespace[0]
          })
          fixWrappingWhitespace(parent, parentChain.slice(0, -1))
        }
      }
    }
  }
  if ('children' in node && node.children.length > 0) {
    node.children.forEach((child) => {
      fixWrappingWhitespace(child, [...parentChain, node])
    })
  }
}

// convert a lexical tree to a markdown string
export function exportMarkdownFromLexical ({
  root,
  toMarkdownOptions = {},
  toMarkdownExtensions = [],
  visitors
}) {
  return toMarkdown(exportLexicalTreeToMdast({ root, visitors }), {
    extensions: toMarkdownExtensions,
    ...toMarkdownOptions
  })
}
