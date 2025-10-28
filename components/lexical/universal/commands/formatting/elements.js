import { createCommand, COMMAND_PRIORITY_EDITOR, FORMAT_ELEMENT_COMMAND, $getSelection, $isRangeSelection } from 'lexical'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import { USE_TRANSFORMER_BRIDGE } from '@/components/lexical/plugins/core/transformer-bridge'
export const SN_FORMAT_ELEMENT_COMMAND = createCommand('SN_FORMAT_ELEMENT_COMMAND')

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
