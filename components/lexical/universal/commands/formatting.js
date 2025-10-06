import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand, FORMAT_TEXT_COMMAND } from 'lexical'
import { $isMarkdownMode } from '../utils'

export const SN_FORMAT_TEXT_COMMAND = createCommand('SN_FORMAT_TEXT_COMMAND')

export const MARKDOWN_TYPES = {
  bold: {
    marker: '**',
    handler: toggleInlineMarkdown
  },
  italic: {
    marker: '*',
    handler: toggleInlineMarkdown
  },
  code: {
    marker: '`',
    handler: toggleInlineMarkdown
  },
  strikethrough: {
    marker: '~~',
    handler: toggleInlineMarkdown
  },
  quote: {
    marker: '>',
    handler: toggleBlockQuote
  },
  underline: {
    marker: '++',
    handler: wrapWithTag
  }
}

function toggleInlineMarkdown (selection, marker) {
  if (!selection) return
  if (selection.isCollapsed()) {
    selection.insertText(marker + marker)
    const { anchor } = selection
    const node = anchor.getNode()
    const offset = anchor.offset
    selection.setTextNodeRange(node, offset - marker.length, node, offset - marker.length)
  } else {
    const text = selection.getTextContent()
    const hasWrap = text.startsWith(marker) && text.endsWith(marker)
    const newText = hasWrap ? text.slice(marker.length, text.length - marker.length) : marker + text + marker
    selection.insertText(newText)
  }
}

function toggleBlockQuote (selection) {
  if (!selection) return
  const text = selection.getTextContent()
  const lines = text.split('\n')
  const allQuoted = lines.every(l => l.startsWith('> '))
  const newLines = allQuoted
    ? lines.map(l => l.replace(/^> /, ''))
    : lines.map(l => (l.length ? `> ${l}` : l))
  selection.insertText(newLines.join('\n'))
}

function wrapWithTag (selection, tag) {
  if (!selection) return
  const before = `<${tag}>`
  const after = `</${tag}>`
  if (selection.isCollapsed()) {
    selection.insertText(before + after)
    const { anchor } = selection
    const node = anchor.getNode()
    const offset = anchor.offset
    selection.setTextNodeRange(node, offset - after.length, node, offset - after.length)
  } else {
    const text = selection.getTextContent()
    const hasWrap = text.startsWith(before) && text.endsWith(after)
    const newText = hasWrap ? text.slice(before.length, text.length - after.length) : before + text + after
    selection.insertText(newText)
  }
}

export function snFormatTextCommand ({ editor }) {
  return editor.registerCommand(SN_FORMAT_TEXT_COMMAND, (type) => {
    const markdownMode = $isMarkdownMode()
    if (!markdownMode) {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, type)
      return true
    }

    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    const handler = MARKDOWN_TYPES[type]?.handler
    if (handler) {
      return handler(selection, MARKDOWN_TYPES[type]?.marker)
    }
    return false
  }, COMMAND_PRIORITY_EDITOR)
}

export function hasMarkdownFormat (selection, type) {
  if (!selection) return
  const text = selection.getTextContent()
  if (!text) return false
  const marker = MARKDOWN_TYPES[type]?.marker
  if (!marker) return false
  return text.startsWith(marker) && text.endsWith(marker) && text.length >= marker.length * 2
}

// find format from selection
export function findMarkdownFormat (selection) {
  if (!selection) return
  const text = selection.getTextContent()
  if (!text) return null
  for (const type in MARKDOWN_TYPES) {
    const marker = MARKDOWN_TYPES[type]?.marker
    if (text.startsWith(marker) && text.endsWith(marker) && text.length >= marker.length * 2) {
      return type
    }
  }
  return null
}
