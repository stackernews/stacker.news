import { $isMarkdownMode } from '@/lib/lexical/commands/utils'
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, COMMAND_PRIORITY_EDITOR, createCommand } from 'lexical'
import { USE_TRANSFORMER_BRIDGE } from '@/components/editor/plugins/core/transformer-bridge'
import { handleMDFormatCommand } from '@/lib/lexical/exts/md-commands'

export const SN_FORMAT_COMMAND = createCommand('SN_FORMAT_COMMAND')

export function registerSNFormatCommand ({ editor }) {
  return editor.registerCommand(SN_FORMAT_COMMAND, (format) => {
    const markdownMode = $isMarkdownMode()
    const selection = $getSelection()

    // lexical rich mode formatting
    if (!markdownMode) {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
      return true
    }

    // markdown mode formatting via transformer bridge
    if (!$isRangeSelection(selection) || selection.isCollapsed()) return handleMDFormatCommand(format)
    // use the transformer bridge to format the format
    return editor.dispatchCommand(USE_TRANSFORMER_BRIDGE, { formatType: 'format', transformation: format })
  }, COMMAND_PRIORITY_EDITOR)
}
