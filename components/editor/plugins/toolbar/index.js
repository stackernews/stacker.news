import ActionTooltip from '@/components/action-tooltip'
import classNames from 'classnames'
import styles from '@/lib/lexical/theme/editor.module.css'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/editor/plugins/upload'
import ModeSwitchPlugin from '@/components/editor/plugins/toolbar/switch'
import UploadIcon from '@/svgs/editor/toolbar/inserts/upload-paperclip.svg'
import { useToolbarState } from '@/components/editor/contexts/toolbar'
import { useEffect, useRef, useState, useCallback } from 'react'
import ArrowLeftIcon from '@/svgs/editor/toolbar/arrow-left.svg'
import MenuIcon from '@/svgs/editor/toolbar/menu.svg'
import BoldIcon from '@/svgs/editor/toolbar/inline/bold.svg'
import ItalicIcon from '@/svgs/editor/toolbar/inline/italic.svg'
import { MD_INSERT_BOLD_COMMAND, MD_INSERT_ITALIC_COMMAND, MD_INSERT_LINK_COMMAND } from '@/lib/lexical/exts/md-commands'
import LinkIcon from '@/svgs/editor/toolbar/inline/link.svg'

export function ToolbarPlugin ({ name, topLevel }) {
  const [editor] = useLexicalComposerContext()
  const { toolbarState } = useToolbarState()
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(topLevel)
  const [hasOverflow, setHasOverflow] = useState(false)
  const toolbarRef = useRef(null)

  const triggerCommand = useCallback((command) => {
    switch (command) {
      case 'bold':
        editor.dispatchCommand(MD_INSERT_BOLD_COMMAND, editor)
        break
      case 'italic':
        editor.dispatchCommand(MD_INSERT_ITALIC_COMMAND, editor)
        break
      case 'link':
        editor.dispatchCommand(MD_INSERT_LINK_COMMAND, editor)
        break
      default:
        break
    }
  }, [editor])

  // overflow detection for mobile devices
  useEffect(() => {
    if (!toolbarRef.current) return

    const checkOverflow = () => {
      if (toolbarRef.current) {
        const hasScrollableContent = toolbarRef.current.scrollWidth > toolbarRef.current.clientWidth
        setHasOverflow(hasScrollableContent)
      }
    }

    checkOverflow()
    if ('ResizeObserver' in window) {
      const resizeObserver = new window.ResizeObserver(checkOverflow)
      resizeObserver.observe(toolbarRef.current)

      return () => resizeObserver.disconnect()
    }
  }, [])

  return (
    <div className={styles.toolbar}>
      <ModeSwitchPlugin name={name} />
      {/* this was FormattingToolbar component, we don't have that many options now */}
      <div className={classNames(styles.innerToolbar, toolbarState.previewMode && styles.hidden)}>
        <div ref={toolbarRef} className={classNames(styles.toolbarFormatting, !showFormattingToolbar && styles.hidden, hasOverflow && styles.hasOverflow)}>
          <ToolbarButton id='bold' onClick={() => triggerCommand('bold')} tooltip='bold'>
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton id='italic' onClick={() => triggerCommand('italic')} tooltip='italic'>
            <ItalicIcon />
          </ToolbarButton>
          <span className={classNames(styles.divider)} />
          <ToolbarButton id='link' onClick={() => triggerCommand('link')} tooltip='link'>
            <LinkIcon />
          </ToolbarButton>
        </div>
        <ActionTooltip notForm overlayText={showFormattingToolbar ? 'hide toolbar' : 'show toolbar'} noWrapper placement='top' showDelay={1000} transition>
          <span className={styles.toolbarItem} onClick={() => setShowFormattingToolbar(!showFormattingToolbar)}>
            {showFormattingToolbar ? <ArrowLeftIcon /> : <MenuIcon />}
          </span>
        </ActionTooltip>
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
