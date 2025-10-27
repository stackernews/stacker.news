import styles from '@/components/lexical/theme/theme.module.css'
import { useState } from 'react'
import InsertTools from './insert'
import FormattingTools from './formatting'
import ActionTooltip from '@/components/action-tooltip'
import { useLexicalPreferences } from '@/components/lexical/contexts/preferences'
import ArrowDownIcon from '@/svgs/lexical/toolbar/arrow-down-s-line.svg'
import PreferencesPlugin from '../core/preferences'

export default function ToolbarPlugin ({ topLevel }) {
  const { prefs } = useLexicalPreferences()
  const [showToolbar, setShowToolbar] = useState(prefs.showToolbar || topLevel)

  return (
    <div className={styles.toolbar}>
      <FormattingTools className={!showToolbar && styles.hidden} />
      <div className='ms-auto d-flex align-items-center'>
        <PreferencesPlugin className={!showToolbar && styles.hidden} />
        <ActionTooltip notForm overlayText={showToolbar ? 'hide toolbar' : 'show toolbar'} noWrapper placement='top' showDelay={1000} transition>
          <span className={styles.toolbarItem} onClick={() => setShowToolbar(!showToolbar)}>
            <ArrowDownIcon style={{ transform: showToolbar ? 'rotate(90deg)' : '' }} />
          </span>
        </ActionTooltip>
        <InsertTools />
      </div>
    </div>
  )
}
