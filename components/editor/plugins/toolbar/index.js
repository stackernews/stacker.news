import ActionTooltip from '@/components/action-tooltip'
import classNames from 'classnames'
import styles from '@/lib/lexical/theme/editor.module.css'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/editor/plugins/upload'
import ModeSwitchPlugin from '@/components/editor/plugins/toolbar/switch'
import UploadIcon from '@/svgs/editor/toolbar/inserts/upload-paperclip.svg'
import { useToolbarState } from '@/components/editor/contexts/toolbar'
import { useEffect, useRef, useState, forwardRef, useCallback } from 'react'
import BoldIcon from '@/svgs/editor/toolbar/inline/bold.svg'
import ItalicIcon from '@/svgs/editor/toolbar/inline/italic.svg'
import {
  MD_INSERT_BLOCK_COMMAND,
  MD_FORMAT_COMMAND
} from '@/lib/lexical/exts/md-commands'
import LinkIcon from '@/svgs/editor/toolbar/inline/link.svg'
import QuoteIcon from '@/svgs/editor/toolbar/block/quote-text.svg'
import CodeIcon from '@/svgs/editor/toolbar/inline/code.svg'
import Dropdown from 'react-bootstrap/Dropdown'
import ArrowDownIcon from '@/svgs/editor/toolbar/arrow-down.svg'
import { createPortal } from 'react-dom'
import SuperscriptIcon from '@/svgs/editor/toolbar/inline/superscript.svg'
import SubscriptIcon from '@/svgs/editor/toolbar/inline/subscript.svg'
import StrikethroughIcon from '@/svgs/editor/toolbar/inline/strikethrough.svg'
import { SHORTCUTS } from '@/lib/lexical/exts/shortcuts'
import BlocksIcon from '@/svgs/editor/toolbar/block/blocks.svg'
import H1Icon from '@/svgs/editor/toolbar/block/h-1.svg'
import H2Icon from '@/svgs/editor/toolbar/block/h-2.svg'
import H3Icon from '@/svgs/editor/toolbar/block/h-3.svg'
import NumberedListIcon from '@/svgs/editor/toolbar/block/number-list.svg'
import BulletListIcon from '@/svgs/editor/toolbar/block/bullet-list.svg'
import CheckListIcon from '@/svgs/editor/toolbar/block/check-list.svg'
import CodeBlockIcon from '@/svgs/editor/toolbar/block/code-block.svg'
import MoreIcon from '@/svgs/editor/toolbar/more-line.svg'
import FontStyleIcon from '@/svgs/editor/toolbar/font-style.svg'

const BLOCK_OPTIONS = [
  { id: 'h1', name: 'heading 1', icon: <H1Icon />, type: 'heading', payload: 1 },
  { id: 'h2', name: 'heading 2', icon: <H2Icon />, type: 'heading', payload: 2 },
  { id: 'h3', name: 'heading 3', icon: <H3Icon />, type: 'heading', payload: 3 },
  { id: 'numberedList', name: 'numbered list', icon: <NumberedListIcon />, type: 'list', payload: 'number' },
  { id: 'bulletList', name: 'bullet list', icon: <BulletListIcon />, type: 'list', payload: 'bullet' },
  { id: 'check', name: 'check list', icon: <CheckListIcon />, type: 'list', payload: 'check' },
  { id: 'codeblock', name: 'code block', icon: <CodeBlockIcon />, type: 'codeblock', payload: 'text' }
]

const FORMAT_OPTIONS = [
  { id: 'superscript', name: 'superscript', icon: <SuperscriptIcon />, type: 'superscript' },
  { id: 'subscript', name: 'subscript', icon: <SubscriptIcon />, type: 'subscript' },
  { id: 'strikethrough', name: 'strikethrough', icon: <StrikethroughIcon />, type: 'strikethrough' }
]

const MenuAlternateDimension = forwardRef(({ children, style, className }, ref) => {
  return createPortal(
    <div ref={ref} style={style} className={className}>
      {children}
    </div>,
    document.body
  )
})

function ToolbarDropdown ({ icon, tooltip, options, onAction, arrow = true, showDelay = 500 }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <ActionTooltip notForm overlayText={tooltip} placement='top' noWrapper showDelay={showDelay} transition disable={dropdownOpen}>
      <Dropdown drop='up' className='pointer' as='span' onToggle={setDropdownOpen} show={dropdownOpen}>
        <Dropdown.Toggle
          as='a'
          onPointerDown={e => e.preventDefault()}
          className={classNames(styles.toolbarItem, dropdownOpen && styles.active)}
        >
          {icon}
          {arrow && <ArrowDownIcon />}
        </Dropdown.Toggle>
        <Dropdown.Menu className={styles.dropdownExtra} as={MenuAlternateDimension}>
          {options.map(option => (
            <DropdownMenuItem
              key={option.id}
              option={option}
              onAction={onAction}
            />
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </ActionTooltip>
  )
}

function DropdownMenuItem ({ option, onAction }) {
  const shortcut = SHORTCUTS[option.id]
  const tooltipText = shortcut ? `${option.name} ${shortcut.key}` : option.name

  return (
    <Dropdown.Item
      title={tooltipText}
      onClick={() => onAction(option)}
      className={styles.dropdownExtraItem}
      onPointerDown={e => e.preventDefault()}
    >
      <span className={styles.dropdownExtraItemLabel}>
        {option.icon}
        <span className={styles.dropdownExtraItemText}>{option.name}</span>
      </span>
      <span className={styles.dropdownExtraItemShortcut}>
        {shortcut?.key}
      </span>
    </Dropdown.Item>
  )
}

function ToolbarButton ({ id, onClick, tooltip, children, showDelay = 500 }) {
  const shortcut = SHORTCUTS[id]
  const tooltipText = shortcut ? `${tooltip} ${shortcut.key}` : tooltip
  return (
    <ActionTooltip notForm overlayText={tooltipText} placement='top' noWrapper showDelay={showDelay} transition>
      <span
        title={tooltipText}
        className={styles.toolbarItem}
        onPointerDown={e => e.preventDefault()}
        onClick={onClick}
      >
        {children}
      </span>
    </ActionTooltip>
  )
}

export function ToolbarPlugin ({ name, topLevel }) {
  const [editor] = useLexicalComposerContext()
  const { toolbarState } = useToolbarState()
  const toolbarRef = useRef(null)
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(topLevel)
  const [hasOverflow, setHasOverflow] = useState(false)

  const handleFormat = useCallback((type) => editor.dispatchCommand(MD_FORMAT_COMMAND, type), [editor])
  const handleInsertBlock = useCallback((type, payload) => editor.dispatchCommand(MD_INSERT_BLOCK_COMMAND, { type, payload }), [editor])

  // overflow detection for mobile devices
  useEffect(() => {
    if (!toolbarRef.current) return

    const checkOverflow = () => {
      if (!toolbarRef.current) return

      const { scrollWidth, clientWidth } = toolbarRef.current
      // rounding for cases in which browser zoom is not 100%
      const hasScrollableContent = scrollWidth - clientWidth > 1

      setHasOverflow(hasScrollableContent)
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
      <div className={classNames(styles.innerToolbar, toolbarState.previewMode && styles.hidden)}>
        <div ref={toolbarRef} className={classNames(styles.toolbarFormatting, !showFormattingToolbar && styles.hidden, hasOverflow && styles.hasOverflow)}>
          <ToolbarDropdown
            icon={<BlocksIcon />}
            tooltip='blocks'
            options={BLOCK_OPTIONS}
            onAction={({ type, payload }) => handleInsertBlock(type, payload)}
          />
          <ToolbarButton id='bold' onClick={() => handleFormat('bold')} tooltip='bold'>
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton id='italic' onClick={() => handleFormat('italic')} tooltip='italic'>
            <ItalicIcon />
          </ToolbarButton>
          <span className={styles.divider} />
          <ToolbarButton id='quote' onClick={() => handleFormat('quote')} tooltip='quote'>
            <QuoteIcon />
          </ToolbarButton>
          <ToolbarButton id='inlineCode' onClick={() => handleFormat('code')} tooltip='inline code'>
            <CodeIcon />
          </ToolbarButton>
          <ToolbarButton id='link' onClick={() => handleFormat('link')} tooltip='link'>
            <LinkIcon />
          </ToolbarButton>
          <span className={styles.divider} />
          <ToolbarDropdown
            icon={<MoreIcon />}
            tooltip='additional formatting options'
            options={FORMAT_OPTIONS}
            onAction={({ type }) => handleFormat(type)}
            arrow={false}
          />
        </div>
        <ActionTooltip notForm overlayText={showFormattingToolbar ? 'hide toolbar' : 'show toolbar'} noWrapper placement='top' showDelay={1000} transition>
          <span className={classNames(styles.toolbarItem, showFormattingToolbar && styles.active)} onClick={() => setShowFormattingToolbar(!showFormattingToolbar)}>
            <FontStyleIcon />
          </span>
        </ActionTooltip>
        <ToolbarButton id='upload' onClick={() => editor.dispatchCommand(SN_UPLOAD_FILES_COMMAND)} tooltip='upload files'>
          <UploadIcon />
        </ToolbarButton>
      </div>
    </div>
  )
}
