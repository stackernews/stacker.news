import { createCommand, COMMAND_PRIORITY_EDITOR, FORMAT_ELEMENT_COMMAND, $getSelection, $isRangeSelection } from 'lexical'
import { $isMarkdownMode } from '@/lib/lexical/universal/utils'
import { USE_TRANSFORMER_BRIDGE } from '@/components/lexical/plugins/core/transformer-bridge'

/** command to format element alignment (left, center, right, justify)
 * @param {string} align - alignment type ('left', 'center', 'right', 'justify')
 * @returns {boolean} true if command was handled
 */
export const SN_FORMAT_ELEMENT_COMMAND = createCommand('SN_FORMAT_ELEMENT_COMMAND')

/**
 * registers command to format element alignment (left, center, right, justify)
 * @param {Object} params.editor - lexical editor instance
 * @returns {Function} unregister function
 */
export const registerSNFormatElementCommand = ({ editor }) => {
  return editor.registerCommand(SN_FORMAT_ELEMENT_COMMAND, (align) => {
    const isMarkdownMode = $isMarkdownMode()
    if (!isMarkdownMode) {
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align)
      return true
    }
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return false
    editor.dispatchCommand(USE_TRANSFORMER_BRIDGE, { formatType: 'elementFormat', transformation: align })
    return true
  }, COMMAND_PRIORITY_EDITOR)
}
