import styles from '@/components/lexical/theme/theme.module.css'
import { useState } from 'react'
import InsertTools from './insert'
import FormattingTools from './formatting'
import LinkTransformationPlugin from '../links/transformator'
import classNames from 'classnames'
import MoreIcon from '@/svgs/more-fill.svg'
import ActionTooltip from '@/components/action-tooltip'

export const ToolbarContent = () => {
  const [showToolbar, setShowToolbar] = useState(false)

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

export default function ToolbarPlugin ({ anchorElem }) {
  return (
    <>
      <ToolbarContent />
      <LinkTransformationPlugin anchorElem={anchorElem} />
    </>
  )
}
