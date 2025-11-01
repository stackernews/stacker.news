import styles from '@/components/lexical/theme/theme.module.css'
import { useState } from 'react'
import FormattingTools from './formatting'
import ActionTooltip from '@/components/action-tooltip'
import { useLexicalPreferences } from '@/components/lexical/contexts/preferences'
import ArrowDownIcon from '@/svgs/lexical/toolbar/arrow-down-s-line.svg'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/lexical/universal/commands/upload'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { getShortcutCombo } from '@/components/lexical/extensions/core/shortcuts/keyboard'
import UploadIcon from '@/svgs/file-upload-line.svg'

export default function ToolbarPlugin ({ topLevel }) {
  const { prefs } = useLexicalPreferences()
  const [editor] = useLexicalComposerContext()
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
        <ActionTooltip notForm overlayText={`upload files ${getShortcutCombo('upload')}`} placement='top' noWrapper showDelay={500} transition>
          <span
            title={`upload files ${getShortcutCombo('upload')}`}
            className={styles.toolbarItem}
            onClick={() => editor.dispatchCommand(SN_UPLOAD_FILES_COMMAND)}
            onPointerDown={e => e.preventDefault()}
          >
            <UploadIcon />
          </span>
        </ActionTooltip>
      </div>
    </div>
  )
}
