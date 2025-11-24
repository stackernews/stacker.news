import { $createTextNode } from 'lexical'
import { $createCodeNode } from '@lexical/code'

const FORMAT_TYPES = ['bold', 'italic', 'strikethrough', 'code', 'subscript', 'superscript', 'underline']

function getFormats (node) {
  return FORMAT_TYPES.filter(format => node.hasFormat(format))
}

export function wrapFormats (text, formats) {
  let result = text
  if (formats.includes('code')) return `\`${text}\``
  if (formats.includes('bold')) result = `**${result}**`
  if (formats.includes('italic')) result = `*${result}*`
  if (formats.includes('strikethrough')) result = `~~${result}~~`
  if (formats.includes('superscript')) result = `<sup>${result}</sup>`
  if (formats.includes('subscript')) result = `<sub>${result}</sub>`
  if (formats.includes('underline')) result = `<u>${result}</u>`
  return result
}

// multi-format text
export const FORMATTED_TEXT = {
  mdastType: 'formattedText',
  toMarkdown: (node, serialize) => {
    const inner = serialize(node.children)
    return wrapFormats(inner, node.formats || [])
  }
}

// plain text and inline formatting
export const TEXT = {
  type: 'text',
  mdastType: ['text', 'strong', 'emphasis', 'delete', 'inlineCode'],
  toMdast: (node) => {
    const text = node.getTextContent()
    const formats = getFormats(node)

    // multi-format: use extended type
    if (formats.length > 1 || formats.some(f => ['superscript', 'subscript', 'underline'].includes(f))) {
      return {
        type: 'formattedText',
        formats,
        children: [{ type: 'text', value: text }],
        data: { lexicalFormat: node.getFormat() }
      }
    }

    // standard mdast types
    if (formats.includes('bold')) {
      return { type: 'strong', children: [{ type: 'text', value: text }] }
    }
    if (formats.includes('italic')) {
      return { type: 'emphasis', children: [{ type: 'text', value: text }] }
    }
    if (formats.includes('strikethrough')) {
      return { type: 'delete', children: [{ type: 'text', value: text }] }
    }
    if (formats.includes('code')) {
      return { type: 'inlineCode', value: text }
    }

    return { type: 'text', value: text }
  },
  fromMdast: (node, visitChildren) => {
    if (node.type === 'text') return $createTextNode(node.value)
    if (node.type === 'inlineCode') return $createTextNode(node.value).toggleFormat('code')

    // for nested formatting, recursively visit children and apply format to each
    if (node.type === 'strong') {
      const children = visitChildren(node.children || [])
      return children.map(child => {
        if (child.toggleFormat) child.toggleFormat('bold')
        return child
      })
    }
    if (node.type === 'emphasis') {
      const children = visitChildren(node.children || [])
      return children.map(child => {
        if (child.toggleFormat) child.toggleFormat('italic')
        return child
      })
    }
    if (node.type === 'delete') {
      const children = visitChildren(node.children || [])
      return children.map(child => {
        if (child.toggleFormat) child.toggleFormat('strikethrough')
        return child
      })
    }
    return null
  },
  toMarkdown: (node, serialize) => {
    if (node.type === 'text') return node.value
    if (node.type === 'inlineCode') return `\`${node.value}\``
    if (node.type === 'strong') return `**${serialize(node.children)}**`
    if (node.type === 'emphasis') return `*${serialize(node.children)}*`
    if (node.type === 'delete') return `~~${serialize(node.children)}~~`
    return ''
  }
}

// code blocks
export const CODE_BLOCK = {
  type: 'code',
  mdastType: 'code',
  toMdast: (node) => ({
    type: 'code',
    lang: node.getLanguage() || null,
    value: node.getTextContent()
  }),
  fromMdast: (node) => {
    if (node.type !== 'code') return null
    return $createCodeNode(node.lang).append($createTextNode(node.value))
  },
  toMarkdown: (node) => `\`\`\`${node.lang || ''}\n${node.value}\n\`\`\`\n\n`
}

export default [FORMATTED_TEXT, TEXT, CODE_BLOCK]
