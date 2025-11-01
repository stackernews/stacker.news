import { createCommand, COMMAND_PRIORITY_EDITOR, FORMAT_TEXT_COMMAND, $getSelection, $isRangeSelection } from 'lexical'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import { USE_TRANSFORMER_BRIDGE } from '@/components/lexical/plugins/core/transformer-bridge'

export const SN_FORMAT_TEXT_COMMAND = createCommand('SN_FORMAT_TEXT_COMMAND')

export const START_END_MARKDOWN_FORMATS = {
  bold: '**',
  italic: ['*', '_'],
  code: '`',
  strikethrough: ['~~', '~'],
  underline: ['++', '__'],
  highlight: ['=='],
  codeblock: '```'
}

function toggleCase (selection, type) {
  const text = selection.getTextContent()
  const newText = type === 'lowercase' ? text.toLowerCase() : text.toUpperCase()
  selection.insertText(newText)
}

function toggleCapitalize (selection) {
  const text = selection.getTextContent()
  const newText = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
  selection.insertText(newText)
}

/* function toggleInlineMarkdown (selection, marker) {
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
} */

function wrapWithTag (selection, beforeTag, afterTag) {
  if (!selection) return
  const before = `<${beforeTag}>`
  const after = `</${afterTag || beforeTag}>`
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

export function registerSNFormatTextCommand ({ editor }) {
  return editor.registerCommand(SN_FORMAT_TEXT_COMMAND, (type) => {
    const markdownMode = $isMarkdownMode()
    if (!markdownMode) {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, type)
      return true
    }

    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    // handle special cases
    switch (type) {
      case 'lowercase':
      case 'uppercase':
        return toggleCase(selection, type)
      case 'capitalize':
        return toggleCapitalize(selection)
      case 'subscript':
        return wrapWithTag(selection, 'sub')
      case 'superscript':
        return wrapWithTag(selection, 'sup')
      default:
        break
    }
    // handle inline markdown
    return editor.dispatchCommand(USE_TRANSFORMER_BRIDGE, { formatType: 'format', transformation: type })
  }, COMMAND_PRIORITY_EDITOR)
}
