import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/lexical/universal/commands/upload'
import Dropdown from 'react-bootstrap/Dropdown'
import styles from '@/components/lexical/theme/theme.module.css'
import AddIcon from '@/svgs/add-fill.svg'
import FileIcon from '@/svgs/file-upload-line.svg'
import { getShortcutCombo } from '@/components/lexical/plugins/shortcuts/keyboard-shortcuts'
import classNames from 'classnames'

export default function InsertTools () {
  const [editor] = useLexicalComposerContext()
  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarInsert}>
        <AddIcon />
      </Dropdown.Toggle>
      <Dropdown.Menu className={styles.dropdownExtra}>
        <Dropdown.Item
          title={'upload files (' + getShortcutCombo('upload') + ')'}
          onClick={() => {
            editor.dispatchCommand(SN_UPLOAD_FILES_COMMAND)
          }}
          className={classNames(styles.dropdownExtraItem)}
        >
          <div className={styles.dropdownExtraItemLabel}>
            <FileIcon />
            <span>upload files</span>
          </div>
          <span className={styles.dropdownExtraItemShortcut}>
            {getShortcutCombo('upload')}
          </span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}
