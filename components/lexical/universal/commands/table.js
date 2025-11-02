import { createCommand, COMMAND_PRIORITY_EDITOR, $getSelection, $isRangeSelection } from 'lexical'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import { INSERT_TABLE_COMMAND } from '@lexical/table'
import { useShowModal } from '@/components/modal'
import { useState } from 'react'

export const SN_INSERT_TABLE_COMMAND = createCommand('SN_INSERT_TABLE_COMMAND')

function TableModal ({ onClose, editor, initialColumns = 2, initialRows = 2 }) {
  const [columns, setColumns] = useState(initialColumns)
  const [rows, setRows] = useState(initialRows)

  return (
    <div>
      <h3>Table</h3>
      <div>
        <div>
          <input
            type='number'
            value={columns}
            onChange={e => setColumns(Number(e.target.value))}
          />
        </div>
        <div>
          <input
            type='number'
            value={rows}
            onChange={e => setRows(Number(e.target.value))}
          />
        </div>
      </div>
      <button
        onClick={() => {
          onClose()
          editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns, rows })
        }}
      >
        Insert
      </button>
    </div>
  )
}

export function registerSNInsertTableCommand ({ editor }) {
  const showModal = useShowModal()

  return editor.registerCommand(SN_INSERT_TABLE_COMMAND, ({ columns = 2, rows = 2 } = {}) => {
    if ($isMarkdownMode()) return false

    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return false
    showModal(onClose => (
      <TableModal onClose={onClose} editor={editor} initialColumns={columns} initialRows={rows} />
    ))
    return true
  }, COMMAND_PRIORITY_EDITOR)
}
