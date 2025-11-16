import Dropdown from 'react-bootstrap/Dropdown'
import styles from '@/components/lexical/theme/theme.module.css'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useToast } from '@/components/toast'
import { useState } from 'react'
import classNames from 'classnames'
import { MenuAlternateDimension } from '@/components/lexical/plugins/toolbar/formatting'

/** DEV: dropdown menu for toggling editor debug options */
export default function DebugPlugin ({ className }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const toaster = useToast()
  const [editor] = useLexicalComposerContext()

  return (
    <Dropdown drop='up' className='pointer' as='span' onToggle={(isOpen) => setDropdownOpen(isOpen)} show={dropdownOpen}>
      <Dropdown.Toggle id='dropdown-basic' as='span' onPointerDown={e => e.preventDefault()} className={classNames(styles.bottomBarItem, className)}>
        options
      </Dropdown.Toggle>
      <Dropdown.Menu className={styles.dropdownExtra} as={MenuAlternateDimension}>
        <Dropdown.Item
          onClick={() => {
            editor.read(() => {
              const json = editor.getEditorState().toJSON()
              navigator.clipboard.writeText(JSON.stringify(json, null, 2))
              toaster.success('editor state copied to clipboard')
            })
          }}
          className={styles.dropdownExtraItem}
        >
          <span className={styles.dropdownExtraItemLabel}>
            <span className={styles.dropdownExtraItemText}>copy editor state JSON</span>
          </span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}
