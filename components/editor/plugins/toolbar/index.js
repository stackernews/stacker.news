import ActionTooltip from '@/components/action-tooltip'
import classNames from 'classnames'
import styles from '@/lib/lexical/theme/editor.module.css'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { SN_UPLOAD_FILES_COMMAND } from '../upload'
import ModeSwitchPlugin from './switch'
import UploadIcon from '@/svgs/editor/toolbar/inserts/upload-paperclip.svg'
import { useToolbarState } from '../../contexts/toolbar'

export function ToolbarPlugin () {
  const [editor] = useLexicalComposerContext()
  const { toolbarState } = useToolbarState()

  return (
    <div className={styles.toolbar}>
      <ModeSwitchPlugin />
      <div className={styles.innerToolbar} style={{ visibility: toolbarState.previewMode ? 'hidden' : 'visible' }}>
        <ToolbarButton id='upload' onClick={() => editor.dispatchCommand(SN_UPLOAD_FILES_COMMAND)} tooltip='upload files'>
          <UploadIcon />
        </ToolbarButton>
      </div>
    </div>
  )
}

/**
 * single button for toolbar with tooltip and active state

 * @param {string} props.id - button identifier
 * @param {boolean} props.isActive - whether button is in active state
 * @param {Function} props.onClick - click handler
 * @param {string} props.tooltip - tooltip text
 * @param {boolean} props.disabled - whether button is disabled
 * @param {number} props.showDelay - tooltip show delay in ms (default 500ms)
 * @returns {JSX.Element} toolbar button component
 */
export function ToolbarButton ({ id, isActive, onClick, tooltip, disabled = false, children, showDelay = 500 }) {
  return (
    <ActionTooltip notForm overlayText={tooltip} placement='top' noWrapper showDelay={showDelay} transition disable={disabled}>
      <span
        title={tooltip}
        className={classNames(styles.toolbarItem, isActive ? styles.active : '')}
        onPointerDown={e => e.preventDefault()}
        onClick={onClick}
      >
        {children}
      </span>
    </ActionTooltip>
  )
}
