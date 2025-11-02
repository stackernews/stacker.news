import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import Dropdown from 'react-bootstrap/Dropdown'
import styles from '@/components/lexical/theme/theme.module.css'
import AddIcon from '@/svgs/add-fill.svg'
import { getShortcutCombo } from '@/components/lexical/extensions/core/shortcuts/keyboard'
import { ToolbarIcon, INSERT_OPTIONS } from './defs/formatting'
import { useState } from 'react'
import ActionTooltip from '@/components/action-tooltip'
import { MenuAlternateDimension } from './formatting'

export default function InsertTools () {
  const [editor] = useLexicalComposerContext()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <ActionTooltip notForm overlayText={<>insert options</>} placement='top' noWrapper showDelay={1000} transition disable={dropdownOpen}>
      <Dropdown className='pointer' as='span' onToggle={(isOpen) => setDropdownOpen(isOpen)} show={dropdownOpen}>
        <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarInsert}>
          <AddIcon />
        </Dropdown.Toggle>
        <Dropdown.Menu className={styles.dropdownExtra} as={MenuAlternateDimension}>
          {INSERT_OPTIONS.filter(option => option.id !== 'upload' && option.id !== 'link').map((option) => (
            <Dropdown.Item
              key={option.id}
              title={`${option.name} (${getShortcutCombo(option.id)})`}
              onClick={() => option.handler({ editor })}
              className={styles.dropdownExtraItem}
            >
              <span className={styles.dropdownExtraItemLabel}>
                <ToolbarIcon id={option.id} />
                <span className={styles.dropdownExtraItemText}>{option.name}</span>
              </span>
              <span className={styles.dropdownExtraItemShortcut}>
                {getShortcutCombo(option.id)}
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </ActionTooltip>
  )
}
