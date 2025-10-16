import styles from '@/components/lexical/theme/theme.module.css'
import { useState } from 'react'
import InsertTools from './insert'
import FormattingTools from './formatting'
import classNames from 'classnames'
import MoreIcon from '@/svgs/more-fill.svg'
import ActionTooltip from '@/components/action-tooltip'
import { useLexicalPreferences } from '@/components/lexical/contexts/preferences'

export const ToolbarContent = ({ topLevel }) => {
  const { prefs } = useLexicalPreferences()
  const [showToolbar, setShowToolbar] = useState(prefs.showToolbar || topLevel)

  return (
    <div className={styles.toolbar}>
      <FormattingTools className={!showToolbar && styles.hidden} />
      <div className='ms-auto d-flex align-items-center'>
        <ActionTooltip notForm overlayText={showToolbar ? 'hide toolbar' : 'show toolbar'} noWrapper placement='top' showDelay={1000} transition>
          <span className={classNames(styles.toolbarItem, showToolbar ? styles.active : '')} onClick={() => setShowToolbar(!showToolbar)}>
            <MoreIcon />
          </span>
        </ActionTooltip>
        <span className={styles.divider} />
        <InsertTools />
      </div>
    </div>
  )
}

export default function ToolbarPlugin ({ topLevel }) {
  return (
    <>
      <ToolbarContent topLevel={topLevel} />
    </>
  )
}
