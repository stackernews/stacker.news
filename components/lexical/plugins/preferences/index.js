import Dropdown from 'react-bootstrap/Dropdown'
import { useLexicalPreferences } from '@/components/lexical/contexts/preferences'
import styles from '@/components/lexical/theme/theme.module.css'
import CheckIcon from '@/svgs/check-line.svg'

// TODO: this could follow the same structure as shortcuts and toolbar item
export default function PreferencesPlugin () {
  const { prefs, setOption } = useLexicalPreferences()

  return (
    <Dropdown className='pointer ms-auto' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.bottomBarItem}>
        preferences
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
      </Dropdown.Menu>
    </Dropdown>
  )
}
