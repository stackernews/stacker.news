import { CodeShikiSNExtension } from '@/components/lexical/extensions/core/code'
import { defineExtension } from '@lexical/extension'
import { createCommand, COMMAND_PRIORITY_EDITOR } from 'lexical'
import { $toggleMarkdownMode } from '@/components/lexical/universal/utils'

export const SN_TOGGLE_MODE_COMMAND = createCommand('SN_TOGGLE_MODE_COMMAND')

export const MarkdownModeExtension = defineExtension({
  name: 'MarkdownModeExtension',
  dependencies: [CodeShikiSNExtension],
  register: (editor) => {
    return editor.registerCommand(SN_TOGGLE_MODE_COMMAND, () => {
      $toggleMarkdownMode()
      return true
    }, COMMAND_PRIORITY_EDITOR)
  }
})
