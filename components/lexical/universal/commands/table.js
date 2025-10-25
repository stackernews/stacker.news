import { createCommand, COMMAND_PRIORITY_EDITOR, $getSelection } from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { INSERT_TABLE_COMMAND } from '@lexical/table'
import { InsertTableDialog } from '../../plugins/inserts/tables/dialog'
import { useShowModal } from '@/components/modal'
import { $isMarkdownMode } from '../utils'

export const SN_TABLE_DIALOG_COMMAND = createCommand('SN_TABLE_DIALOG_COMMAND')
export const SN_INSERT_TABLE_COMMAND = createCommand('SN_INSERT_TABLE_COMMAND')
export function registerSNInsertTableCommand ({ editor }) {
  return editor.registerCommand(SN_INSERT_TABLE_COMMAND, ({ rows = 3, columns = 3 } = {}) => {
    const isMarkdownMode = $isMarkdownMode()
    if (!isMarkdownMode) {
      editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows, columns })
      return true
    }
    const selection = $getSelection()
    // just insert the table in markdown mode without selection
    // Create header row with proper number of columns
    const headerCells = '|' + '   |'.repeat(columns)
    const separatorCells = '|' + ' --- |'.repeat(columns)

    // Create data rows
    const dataRows = Array(rows - 1).fill(0).map(() => {
      const cells = '|' + '   |'.repeat(columns)
      return cells
    }).join('\n')

    const tableText = `${headerCells}\n${separatorCells}\n${dataRows}`
    selection.insertText(tableText)
    return true
  }, COMMAND_PRIORITY_EDITOR)
}

export function registerSNTableDialogCommand ({ editor }) {
  return editor.registerCommand(SN_TABLE_DIALOG_COMMAND, () => {
    const showModal = useShowModal()
    showModal(onClose => <InsertTableDialog editor={editor} onClose={onClose} />)
    return true
  }, COMMAND_PRIORITY_EDITOR)
}

export function registerSNTableCommands ({ editor }) {
  return mergeRegister(
    registerSNInsertTableCommand({ editor }),
    registerSNTableDialogCommand({ editor })
  )
}
