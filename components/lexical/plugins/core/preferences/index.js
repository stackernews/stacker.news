import Dropdown from 'react-bootstrap/Dropdown'
import CheckIcon from '@/svgs/check-line.svg'
import styles from '@/components/lexical/theme/theme.module.css'
import { useLexicalPreferences } from '@/components/lexical/contexts/preferences'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useToast } from '@/components/toast'
import { useState } from 'react'
import SettingsIcon from '@/svgs/lexical/toolbar/equalizer-line.svg'
import classNames from 'classnames'
import ActionTooltip from '@/components/action-tooltip'
import { MenuAlternateDimension } from '@/components/lexical/plugins/toolbar/formatting'

// TODO: this could follow the same structure as shortcuts and toolbar item
export default function PreferencesPlugin ({ className }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const toaster = useToast()
  const [editor] = useLexicalComposerContext()
  const { prefs, setOption } = useLexicalPreferences()

  return (
    <div className={classNames(styles.toolbarFormatting, className)}>
      <ActionTooltip notForm overlayText='debug preferences' placement='top' noWrapper showDelay={500} transition disable={dropdownOpen}>
        <Dropdown drop='up' className='pointer' as='span' onToggle={(isOpen) => setDropdownOpen(isOpen)} show={dropdownOpen}>
          <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={classNames(styles.toolbarItem, dropdownOpen ? styles.active : '')}>
            <SettingsIcon />
          </Dropdown.Toggle>
          <Dropdown.Menu className={styles.dropdownExtra} as={MenuAlternateDimension}>
            <Dropdown.Item onClick={() => setOption('startInMarkdown', !prefs.startInMarkdown)} className={styles.dropdownExtraItem}>
              <span className={styles.dropdownExtraItemLabel}>
                {prefs.startInMarkdown && <CheckIcon />}
                <span className={styles.dropdownExtraItemText}>start in markdown</span>
              </span>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setOption('showToolbar', !prefs.showToolbar)} className={styles.dropdownExtraItem}>
              <span className={styles.dropdownExtraItemLabel}>
                {prefs.showToolbar && <CheckIcon />}
                <span className={styles.dropdownExtraItemText}>show full toolbar</span>
              </span>
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setOption('showFloatingToolbar', !prefs.showFloatingToolbar)} className={styles.dropdownExtraItem}>
              <span className={styles.dropdownExtraItemLabel}>
                {prefs.showFloatingToolbar && <CheckIcon />}
                <span className={styles.dropdownExtraItemText}>show floating toolbar</span>
              </span>
            </Dropdown.Item>
            <hr className='dropdown-divider' />
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
      </ActionTooltip>
    </div>
  )
}
