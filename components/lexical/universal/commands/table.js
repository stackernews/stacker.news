import { createCommand, COMMAND_PRIORITY_EDITOR, $getSelection, $isRangeSelection } from 'lexical'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import { INSERT_TABLE_COMMAND } from '@lexical/table'

export const SN_INSERT_TABLE_COMMAND = createCommand('SN_INSERT_TABLE_COMMAND')

export function registerSNInsertTableCommand ({ editor }) {
  return editor.registerCommand(SN_INSERT_TABLE_COMMAND, ({ columns = 5, rows = 3 } = {}) => {
    if ($isMarkdownMode()) return false

    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return false
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns, rows })
    return true
  }, COMMAND_PRIORITY_EDITOR)
}
