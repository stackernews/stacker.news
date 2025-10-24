import styles from '@/components/lexical/theme/theme.module.css'
import { useState } from 'react'
import InsertTools from './insert'
import FormattingTools from './formatting'
import ActionTooltip from '@/components/action-tooltip'
import { useLexicalPreferences } from '@/components/lexical/contexts/preferences'
import ArrowDownIcon from '@/svgs/lexical/toolbar/arrow-down-s-line.svg'

export default function ToolbarPlugin ({ topLevel }) {
  const { prefs } = useLexicalPreferences()
  const [showToolbar, setShowToolbar] = useState(prefs.showToolbar || topLevel)

  return (
    <div className={styles.toolbar}>
      <ActionTooltip notForm overlayText={showToolbar ? 'hide toolbar' : 'show toolbar'} noWrapper placement='top' showDelay={1000} transition>
        <span className={styles.toolbarItem} onClick={() => setShowToolbar(!showToolbar)}>
          <ArrowDownIcon style={{ transform: showToolbar ? 'rotate(-90deg)' : '' }} />
        </span>
      </ActionTooltip>
      <FormattingTools className={!showToolbar && styles.hidden} />
      <div className='ms-auto d-flex align-items-center'>
        <InsertTools />
      </div>
    </div>
  )
}
