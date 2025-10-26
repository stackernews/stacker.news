import Dropdown from 'react-bootstrap/Dropdown'
import CheckIcon from '@/svgs/check-line.svg'
import styles from '@/components/lexical/theme/theme.module.css'
import { useLexicalPreferences } from '@/components/lexical/contexts/preferences'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useToast } from '@/components/toast'

// TODO: this could follow the same structure as shortcuts and toolbar item
export default function PreferencesPlugin () {
  const toaster = useToast()
  const [editor] = useLexicalComposerContext()
  const { prefs, setOption } = useLexicalPreferences()

  return (
    <Dropdown as='span'>
      <Dropdown.Toggle className={styles.bottomBarItem} id='dropdown-basic' as='span' onPointerDown={e => e.preventDefault()}>
        debug preferences
      </Dropdown.Toggle>
      <Dropdown.Menu className={styles.dropdownExtra}>
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
  )
}
