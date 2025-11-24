import { $createParagraphNode, $createTextNode } from 'lexical'
import { $createMathNode } from '@/lib/lexical/nodes/formatting/math'
import { $createTableOfContentsNode } from '@/lib/lexical/nodes/misc/toc'

// table of contents
export const TABLE_OF_CONTENTS = {
  priority: 10,
  type: 'tableofcontents',
  mdastType: ['tableOfContents', 'paragraph'],
  toMdast: () => ({ type: 'tableOfContents' }),
  fromMdast: (node) => {
    if (node.type === 'paragraph' &&
        node.children?.length === 1 &&
        node.children[0].type === 'text' &&
        node.children[0].value.trim() === '{:toc}') {
      return $createTableOfContentsNode()
    }
    return null
  },
  toMarkdown: () => '{:toc}\n\n'
}

// math (inline and block)
export const MATH = {
  type: 'math',
  mdastType: ['math', 'inlineMath'],
  toMdast: (node) => {
    const inline = node.getInline?.()
    return {
      type: inline ? 'inlineMath' : 'math',
      value: node.getValue?.() || node.getTextContent()
    }
  },
  fromMdast: (node) => {
    if (node.type === 'inlineMath') return $createMathNode(node.value, true)
    if (node.type === 'math') return $createMathNode(node.value, false)
    return null
  },
  toMarkdown: (node) => {
    if (node.type === 'inlineMath') return `$$${node.value}$$`
    return `$$\n${node.value}\n$$\n\n`
  }
}

// footnotes (renders as text)
// TODO: this
export const FOOTNOTE = {
  mdastType: ['footnoteReference', 'footnoteDefinition'],
  fromMdast: (node) => {
    if (node.type === 'footnoteReference') {
      return $createTextNode(`[^${node.identifier}]`)
    }
    if (node.type === 'footnoteDefinition') {
      const content = node.children?.map(c => c.value || '').join(' ') || ''
      return $createParagraphNode().append($createTextNode(`[^${node.identifier}]: ${content}`))
    }
    return null
  },
  toMarkdown: (node) => {
    if (node.type === 'footnoteReference') return `[^${node.identifier}]`
    if (node.type === 'footnoteDefinition') {
      return `[^${node.identifier}]: ${node.children?.map(c => c.value || '').join(' ')}\n\n`
    }
    return ''
  }
}

export default [
  TABLE_OF_CONTENTS,
  MATH,
  FOOTNOTE
]
