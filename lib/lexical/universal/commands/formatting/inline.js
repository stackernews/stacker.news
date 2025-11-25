import { createCommand, COMMAND_PRIORITY_EDITOR, FORMAT_TEXT_COMMAND, $getSelection, $isRangeSelection } from 'lexical'
import { $isMarkdownMode } from '@/lib/lexical/universal/utils'
import { USE_TRANSFORMER_BRIDGE } from '@/components/lexical/plugins/core/transformer-bridge'

/** command to format text (bold, italic, etc.)
 * @param {string} type - text format type ('bold', 'italic', 'code', 'strikethrough', 'underline', 'highlight', 'codeblock')
 * @returns {boolean} true if command was handled
 */
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

/**
 * toggles text case (uppercase/lowercase) for selection
 * @param {Object} selection - lexical selection object
 * @param {string} type - 'lowercase' or 'uppercase'
 */
function toggleCase (selection, type) {
  const text = selection.getTextContent()
  const newText = type === 'lowercase' ? text.toLowerCase() : text.toUpperCase()
  selection.insertText(newText)
}

/**
 * capitalizes first character and lowercases rest of selection
 * @param {Object} selection - lexical selection object
 */
function toggleCapitalize (selection) {
  const text = selection.getTextContent()
  const newText = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
  selection.insertText(newText)
}

/**
 * wraps selection with an HTML tag
 * @param {Object} selection - lexical selection object
 * @param {string} beforeTag - opening HTML tag to wrap selection with
 * @param {string} afterTag - closing HTML tag to wrap selection with
 */
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

/**
 * registers command to format text (bold, italic, etc.) in markdown and rich text mode
 * @param {Object} params.editor - lexical editor instance
 * @returns {Function} unregister function
 */
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
