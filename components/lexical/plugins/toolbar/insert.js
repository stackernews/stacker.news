import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import Dropdown from 'react-bootstrap/Dropdown'
import styles from '@/components/lexical/theme/theme.module.css'
import AddIcon from '@/svgs/add-fill.svg'
import { getShortcutCombo } from '@/components/lexical/plugins/shortcuts/keyboard'
import { useShowModal } from '@/components/modal'
import { INSERT_OPTIONS } from './defs/formatting'
import { useCallback } from 'react'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/lexical/universal/commands/upload'
import { SN_TABLE_DIALOG_COMMAND } from '@/components/lexical/universal/commands/table'
import { SN_INSERT_MATH_COMMAND } from '@/components/lexical/universal/commands/math'

export default function InsertTools () {
  const [editor] = useLexicalComposerContext()
  const showModal = useShowModal()

  const handleInsert = useCallback((insert) => {
    switch (insert) {
      case 'upload':
        editor.dispatchCommand(SN_UPLOAD_FILES_COMMAND)
        break
      case 'table':
        editor.dispatchCommand(SN_TABLE_DIALOG_COMMAND)
        break
      case 'math':
        editor.dispatchCommand(SN_INSERT_MATH_COMMAND)
        break
      case 'math-inline':
        editor.dispatchCommand(SN_INSERT_MATH_COMMAND, { inline: true })
        break
    }
  }, [editor, showModal])

  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarInsert}>
        <AddIcon />
      </Dropdown.Toggle>
      <Dropdown.Menu className={styles.dropdownExtra}>
        {INSERT_OPTIONS.map((option) => (
          <Dropdown.Item
            key={option.action}
            title={`${option.name} (${getShortcutCombo(option.action)})`}
            onClick={() => { handleInsert(option.action) }}
            className={styles.dropdownExtraItem}
          >
            <span className={styles.dropdownExtraItemLabel}>
              {option.icon}
              <span className={styles.dropdownExtraItemText}>{option.name}</span>
            </span>
            <span className={styles.dropdownExtraItemShortcut}>
              {getShortcutCombo(option.action)}
            </span>
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  )
}
