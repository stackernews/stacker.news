import { $isMarkdownMode } from '@/lib/lexical/commands/utils'
import { $getSelection, FORMAT_TEXT_COMMAND, COMMAND_PRIORITY_EDITOR, createCommand } from 'lexical'
import { USE_TRANSFORMER_BRIDGE } from '@/components/editor/plugins/core/transformer-bridge'

export const SN_FORMAT_COMMAND = createCommand('SN_FORMAT_COMMAND')

export function registerSNFormatCommand ({ editor }) {
  return editor.registerCommand(SN_FORMAT_COMMAND, (format) => {
    const markdownMode = $isMarkdownMode()

    // lexical rich mode formatting
    if (!markdownMode) {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
      return true
    }

    // markdown mode formatting via transformer bridge
    const selection = $getSelection()
    // TODO
    if (!selection) console.log('implement no selection fallback, e.g. empty format')
    // use the transformer bridge to format the format
    return editor.dispatchCommand(USE_TRANSFORMER_BRIDGE, { formatType: 'format', transformation: format })
  }, COMMAND_PRIORITY_EDITOR)
}
