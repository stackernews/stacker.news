import ActionTooltip from '@/components/action-tooltip'
import classNames from 'classnames'
import styles from '@/lib/lexical/theme/editor.module.css'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/editor/plugins/upload'
import ModeSwitchPlugin from '@/components/editor/plugins/toolbar/switch'
import UploadIcon from '@/svgs/editor/toolbar/inserts/upload-paperclip.svg'
import { useToolbarState } from '@/components/editor/contexts/toolbar'
import { useEffect, useRef, useState, useCallback, forwardRef } from 'react'
import ArrowLeftIcon from '@/svgs/editor/toolbar/arrow-left.svg'
import MenuIcon from '@/svgs/editor/toolbar/menu.svg'
import BoldIcon from '@/svgs/editor/toolbar/inline/bold.svg'
import ItalicIcon from '@/svgs/editor/toolbar/inline/italic.svg'
import { MD_INSERT_BOLD_COMMAND, MD_INSERT_ITALIC_COMMAND, MD_INSERT_LINK_COMMAND, MD_INSERT_QUOTE_COMMAND, MD_INSERT_CODE_COMMAND, MD_INSERT_SUPERSCRIPT_COMMAND, MD_INSERT_SUBSCRIPT_COMMAND, MD_INSERT_STRIKETHROUGH_COMMAND, MD_INSERT_HEADING_COMMAND, MD_INSERT_LIST_COMMAND, MD_INSERT_CODEBLOCK_COMMAND } from '@/lib/lexical/exts/md-commands'
import LinkIcon from '@/svgs/editor/toolbar/inline/link.svg'
import QuoteIcon from '@/svgs/editor/toolbar/block/quote-text.svg'
import CodeIcon from '@/svgs/editor/toolbar/inline/code.svg'
import Dropdown from 'react-bootstrap/Dropdown'
import ArrowDownIcon from '@/svgs/editor/toolbar/arrow-down.svg'
import { createPortal } from 'react-dom'
import FontStyleIcon from '@/svgs/editor/toolbar/font-style.svg'
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

/**
 * portal component that renders dropdown menus outside the toolbar to escape overflow rules

 * @param {React.ReactNode} props.children - menu content to render
 * @param {Object} props.style - inline styles
 * @param {string} props.className - css classes
 * @param {React.Ref} ref - forwarded ref
 * @returns {React.ReactPortal} portal to document body
 */
export const MenuAlternateDimension = forwardRef(({ children, style, className }, ref) => {
  return createPortal(
    <div ref={ref} style={style} className={className}>
      {children}
    </div>,
    document.body
  )
})

/**
 * single menu item within a toolbar dropdown

 * @param {Object} props.option - menu option configuration
 * @param {boolean} props.isActive - whether option is currently active
 * @param {Function} props.onClick - click handler
 * @param {React.ReactNode} props.icon - icon to display in menu item
 * @returns {JSX.Element} dropdown menu item
 */
function DropdownMenuItem ({ option, isActive, onClick, icon }) {
  const shortcut = SHORTCUTS[option.id]
  const tooltipText = shortcut ? `${option.name} ${shortcut.key}` : option.name

  return (
    <Dropdown.Item
      key={option.id}
      title={tooltipText}
      onClick={onClick}
      className={classNames(styles.dropdownExtraItem, isActive ? styles.active : '')}
      onPointerDown={e => e.preventDefault()}
    >
      <span className={styles.dropdownExtraItemLabel}>
        {icon}
        <span className={styles.dropdownExtraItemText}>{option.name}</span>
      </span>
      <span className={styles.dropdownExtraItemShortcut}>
        {shortcut?.key}
      </span>
    </Dropdown.Item>
  )
}

/**
 * dropdown button for toolbar with tooltip and menu options

 * @param {Object} props.editor - lexical editor instance
 * @param {React.ReactNode} props.icon - icon to display in button
 * @param {string} props.tooltip - tooltip text
 * @param {Array} props.options - menu options to display
 * @param {string} props.activeOptionId - currently active option id
 * @param {Function} props.getIsActive - function to determine if option is active
 * @param {number} props.showDelay - tooltip show delay in ms
 * @param {boolean} props.arrow - whether to show dropdown arrow
 * @param {string} props.className - additional css classes
 * @returns {JSX.Element} toolbar dropdown component
 */
export function ToolbarDropdown ({ editor, icon, tooltip, options, activeOptionId, getIsActive, showDelay = 500, arrow = true, className }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <ActionTooltip notForm overlayText={tooltip} placement='top' noWrapper showDelay={showDelay} transition disable={dropdownOpen}>
      <Dropdown drop='up' className='pointer' as='span' onToggle={setDropdownOpen} show={dropdownOpen}>
        <Dropdown.Toggle
          id='dropdown-basic'
          as='a'
          onPointerDown={e => e.preventDefault()}
          className={classNames(className || styles.toolbarItem, dropdownOpen ? styles.active : '')}
        >
          {icon}
          {arrow && <ArrowDownIcon />}
        </Dropdown.Toggle>
        <Dropdown.Menu className={styles.dropdownExtra} as={MenuAlternateDimension}>
          {options?.map(option => (
            <DropdownMenuItem
              key={option.id}
              option={option}
              isActive={getIsActive ? getIsActive(option.lookup || option.id) : activeOptionId === option.id}
              onClick={() => editor.dispatchCommand(option.command, option.payload || editor)}
              icon={option.icon}
            />
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </ActionTooltip>
  )
}

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
      case 'quote':
        editor.dispatchCommand(MD_INSERT_QUOTE_COMMAND, editor)
        break
      case 'inlineCode':
        editor.dispatchCommand(MD_INSERT_CODE_COMMAND, editor)
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
          <ToolbarDropdown
            icon={<BlocksIcon />}
            tooltip='blocks'
            options={[
              { id: 'h1', name: 'heading 1', icon: <H1Icon />, command: MD_INSERT_HEADING_COMMAND, payload: 1 },
              { id: 'h2', name: 'heading 2', icon: <H2Icon />, command: MD_INSERT_HEADING_COMMAND, payload: 2 },
              { id: 'h3', name: 'heading 3', icon: <H3Icon />, command: MD_INSERT_HEADING_COMMAND, payload: 3 },
              { id: 'numberedList', name: 'numbered list', icon: <NumberedListIcon />, command: MD_INSERT_LIST_COMMAND, payload: 'number' },
              { id: 'bulletList', name: 'bullet list', icon: <BulletListIcon />, command: MD_INSERT_LIST_COMMAND, payload: 'bullet' },
              { id: 'check', name: 'check list', icon: <CheckListIcon />, command: MD_INSERT_LIST_COMMAND, payload: 'check' },
              // implement language selection for code block
              { id: 'codeblock', name: 'code block', icon: <CodeBlockIcon />, command: MD_INSERT_CODEBLOCK_COMMAND, payload: { language: 'text' } }
            ]}
            getIsActive={(lookup) => toolbarState[lookup]}
            editor={editor}
          />
          <ToolbarButton id='bold' onClick={() => triggerCommand('bold')} tooltip='bold'>
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton id='italic' onClick={() => triggerCommand('italic')} tooltip='italic'>
            <ItalicIcon />
          </ToolbarButton>
          <span className={classNames(styles.divider)} />
          <ToolbarButton id='quote' onClick={() => triggerCommand('quote')} tooltip='quote'>
            <QuoteIcon />
          </ToolbarButton>
          <ToolbarButton id='inlineCode' onClick={() => triggerCommand('inlineCode')} tooltip='code'>
            <CodeIcon />
          </ToolbarButton>
          <ToolbarButton id='link' onClick={() => triggerCommand('link')} tooltip='link'>
            <LinkIcon />
          </ToolbarButton>
          <span className={classNames(styles.divider)} />
          <ToolbarDropdown
            icon={<FontStyleIcon />}
            tooltip='additional formatting options'
            options={[
              { id: 'superscript', name: 'superscript', icon: <SuperscriptIcon />, command: MD_INSERT_SUPERSCRIPT_COMMAND },
              { id: 'subscript', name: 'subscript', icon: <SubscriptIcon />, command: MD_INSERT_SUBSCRIPT_COMMAND },
              { id: 'strikethrough', name: 'strikethrough', icon: <StrikethroughIcon />, command: MD_INSERT_STRIKETHROUGH_COMMAND }
            ]}
            getIsActive={(lookup) => toolbarState[lookup]}
            editor={editor}
          />
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
  const shortcut = SHORTCUTS[id]
  const tooltipText = shortcut ? `${tooltip} ${shortcut.key}` : tooltip
  return (
    <ActionTooltip notForm overlayText={tooltipText} placement='top' noWrapper showDelay={showDelay} transition disable={disabled}>
      <span
        title={tooltipText}
        className={classNames(styles.toolbarItem, isActive ? styles.active : '')}
        onPointerDown={e => e.preventDefault()}
        onClick={onClick}
      >
        {children}
      </span>
    </ActionTooltip>
  )
}
