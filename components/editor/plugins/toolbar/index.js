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
import LinkIcon from '@/svgs/editor/toolbar/inline/link.svg'
import QuoteIcon from '@/svgs/editor/toolbar/block/quote-text.svg'
import CodeIcon from '@/svgs/editor/toolbar/inline/code.svg'
import Dropdown from 'react-bootstrap/Dropdown'
import ArrowDownIcon from '@/svgs/editor/toolbar/arrow-down.svg'
import { createPortal } from 'react-dom'
import SuperscriptIcon from '@/svgs/editor/toolbar/inline/superscript.svg'
import SubscriptIcon from '@/svgs/editor/toolbar/inline/subscript.svg'
import StrikethroughIcon from '@/svgs/editor/toolbar/inline/strikethrough.svg'
import { SHORTCUTS, useFormattedShortcut } from '@/components/editor/plugins/core/shortcuts'
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
import { useIsClient } from '@/components/use-client'
import { SN_FORMAT_BLOCK_COMMAND } from '@/lib/lexical/commands/formatting/blocks'
import { SN_FORMAT_COMMAND } from '@/lib/lexical/commands/formatting/format'
import { SN_TOGGLE_LINK_COMMAND } from '@/lib/lexical/commands/links'
import { COMMAND_PRIORITY_CRITICAL, $getSelection, $isRangeSelection, $isNodeSelection } from 'lexical'
import { mergeRegister, $getNearestNodeOfType } from '@lexical/utils'
import { SELECTION_CHANGE_COMMAND } from '@lexical/selection'
import { $snGetBlockType, $snGetElementFormat, $snHasLink } from '@/lib/lexical/commands/formatting/utils'
import { $findTopLevelElement } from '@/lib/lexical/commands/utils'
import { $isElementNode, $isCodeNode } from '@lexical/rich-text'
import { normalizeCodeLanguage } from '@lexical/code-shiki'
import { ListNode } from '@lexical/list'

const BLOCK_OPTIONS = [
  { id: 'paragraph', name: 'paragraph', icon: <BlocksIcon />, block: 'paragraph' },
  { id: 'h1', name: 'heading 1', icon: <H1Icon />, block: 'h1' },
  { id: 'h2', name: 'heading 2', icon: <H2Icon />, block: 'h2' },
  { id: 'h3', name: 'heading 3', icon: <H3Icon />, block: 'h3' },
  { id: 'numberedList', name: 'numbered list', icon: <NumberedListIcon />, block: 'number' },
  { id: 'bulletList', name: 'bullet list', icon: <BulletListIcon />, block: 'bullet' },
  { id: 'check', name: 'check list', icon: <CheckListIcon />, block: 'check' },
  { id: 'codeblock', name: 'code block', icon: <CodeBlockIcon />, block: 'code' }
]

const FORMAT_OPTIONS = [
  { id: 'superscript', active: 'isSuperscript', name: 'superscript', icon: <SuperscriptIcon />, type: 'superscript' },
  { id: 'subscript', active: 'isSubscript', name: 'subscript', icon: <SubscriptIcon />, type: 'subscript' },
  { id: 'strikethrough', active: 'isStrikethrough', name: 'strikethrough', icon: <StrikethroughIcon />, type: 'strikethrough' }
]

const MenuAlternateDimension = forwardRef(function MenuAlternateDimension ({ children, style, className }, ref) {
  // document doesn't exist on SSR
  const isClient = useIsClient()
  if (!isClient) return null

  return createPortal(
    <div ref={ref} style={style} className={className}>
      {children}
    </div>,
    document.body
  )
})

function ToolbarDropdown ({ icon, tooltip, options, onAction, arrow = true, showDelay = 500 }) {
  const { toolbarState } = useToolbarState()
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
              isActive={option.active ? toolbarState[option.active] : option.block === toolbarState.blockType}
            />
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </ActionTooltip>
  )
}

// TODO: isActive should not work in markdown mode
function DropdownMenuItem ({ option, onAction, isActive }) {
  const shortcut = SHORTCUTS[option.id]
  const shortcutDisplay = useFormattedShortcut(shortcut?.key)
  const tooltipText = shortcutDisplay ? `${option.name} (${shortcutDisplay})` : option.name

  return (
    <Dropdown.Item
      title={tooltipText}
      onClick={() => onAction(option)}
      className={classNames(styles.dropdownExtraItem, isActive && styles.active)}
      onPointerDown={e => e.preventDefault()}
    >
      <span className={styles.dropdownExtraItemLabel}>
        {option.icon}
        <span className={styles.dropdownExtraItemText}>{option.name}</span>
      </span>
      <span className={styles.dropdownExtraItemShortcut}>
        {shortcutDisplay}
      </span>
    </Dropdown.Item>
  )
}

// TODO: isActive should not work in markdown mode
function ToolbarButton ({ id, isActive, onClick, tooltip, children, showDelay = 500 }) {
  const shortcut = SHORTCUTS[id]
  const shortcutDisplay = useFormattedShortcut(shortcut?.key)
  const tooltipText = shortcutDisplay ? `${tooltip} (${shortcutDisplay})` : tooltip
  return (
    <ActionTooltip notForm overlayText={tooltipText} placement='top' noWrapper showDelay={showDelay} transition>
      <span
        title={tooltipText}
        className={classNames(styles.toolbarItem, isActive && styles.active)}
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
  const { batchUpdateToolbarState, toolbarState, updateToolbarState } = useToolbarState()
  const toolbarRef = useRef(null)
  const [hasOverflow, setHasOverflow] = useState(false)

  const handleFormat = useCallback((type) => editor.dispatchCommand(SN_FORMAT_COMMAND, type), [editor])
  const handleFormatBlock = useCallback((block) => editor.dispatchCommand(SN_FORMAT_BLOCK_COMMAND, block), [editor])
  const handleToggleLink = useCallback(() => editor.dispatchCommand(SN_TOGGLE_LINK_COMMAND), [editor])

  const $updateToolbar = useCallback(() => {
    const updates = {}
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      updates.elementFormat = $snGetElementFormat(selection)
      updates.isLink = $snHasLink(selection)
      updates.isBold = selection.hasFormat('bold')
      updates.isItalic = selection.hasFormat('italic')
      updates.isUnderline = selection.hasFormat('underline')
      updates.isStrikethrough = selection.hasFormat('strikethrough')
      updates.isCode = selection.hasFormat('code')
      updates.isHighlight = selection.hasFormat('highlight')
      updates.isSubscript = selection.hasFormat('subscript')
      updates.isSuperscript = selection.hasFormat('superscript')
      updates.isLowercase = selection.hasFormat('lowercase')
      updates.isUppercase = selection.hasFormat('uppercase')
      updates.isCapitalize = selection.hasFormat('capitalize')
    }

    // handles range and node selections
    updates.blockType = $snGetBlockType(selection)

    if ($isNodeSelection(selection)) {
      const nodes = selection.getNodes()
      for (const selectedNode of nodes) {
        const parentList = $getNearestNodeOfType(selectedNode, ListNode)
        if (!parentList) {
          const selectedElement = $findTopLevelElement(selectedNode)
          if ($isCodeNode(selectedElement)) {
            const language = selectedElement.getLanguage()
            updates.codeLanguage = language ? normalizeCodeLanguage(language) || language : ''
          }
          if ($isElementNode(selectedElement)) {
            updates.elementFormat = selectedElement.getFormatType()
          }
        }
      }
    }

    batchUpdateToolbarState(updates)
  }, [])

  useEffect(() => {
    // markdown mode doesn't support toolbar updates
    if (toolbarState.editorMode === 'markdown') return

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => { $updateToolbar() }, { editor })
      }),
      editor.registerCommand(SELECTION_CHANGE_COMMAND,
        (_payload, _newEditor) => {
          $updateToolbar()
          return false
        },
        COMMAND_PRIORITY_CRITICAL
      )
    )
  }, [editor, $updateToolbar, toolbarState.editorMode])

  // overflow detection for mobile devices
  useEffect(() => {
    const element = toolbarRef.current
    if (!element) return

    const checkOverflow = () => {
      if (!element) return

      const { scrollWidth, clientWidth } = element
      // rounding for cases in which browser zoom is not 100%
      const hasScrollableContent = scrollWidth - clientWidth > 1

      setHasOverflow(hasScrollableContent)
    }

    checkOverflow()
    if ('ResizeObserver' in window) {
      const resizeObserver = new window.ResizeObserver(checkOverflow)
      resizeObserver.observe(element)

      return () => resizeObserver.disconnect()
    }
  }, [])

  return (
    <div className={styles.toolbar}>
      <ModeSwitchPlugin name={name} />
      <div className={classNames(styles.innerToolbar, toolbarState.previewMode && styles.toolbarHidden)}>
        <div ref={toolbarRef} className={classNames(styles.toolbarFormatting, !toolbarState.showFormattingToolbar && styles.toolbarHidden, hasOverflow && styles.hasOverflow)}>
          <ToolbarDropdown
            icon={<BlocksIcon />}
            tooltip='blocks'
            options={BLOCK_OPTIONS}
            onAction={({ block }) => handleFormatBlock(block)}
          />
          <ToolbarButton id='bold' isActive={toolbarState.isBold} onClick={() => handleFormat('bold')} tooltip='bold'>
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton id='italic' isActive={toolbarState.isItalic} onClick={() => handleFormat('italic')} tooltip='italic'>
            <ItalicIcon />
          </ToolbarButton>
          <span className={styles.divider} />
          <ToolbarButton id='quote' isActive={toolbarState.blockType === 'quote'} onClick={() => handleFormatBlock('quote')} tooltip='quote'>
            <QuoteIcon />
          </ToolbarButton>
          <ToolbarButton id='inlineCode' isActive={toolbarState.isCode} onClick={() => handleFormat('code')} tooltip='inline code'>
            <CodeIcon />
          </ToolbarButton>
          <ToolbarButton id='link' isActive={toolbarState.isLink} onClick={() => handleToggleLink()} tooltip='link'>
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
        <ActionTooltip notForm overlayText={toolbarState.showFormattingToolbar ? 'hide toolbar' : 'show toolbar'} noWrapper placement='top' showDelay={1000} transition>
          <span onPointerDown={e => e.preventDefault()} className={classNames(styles.toolbarItem, toolbarState.showFormattingToolbar && styles.active)} onClick={() => updateToolbarState('showFormattingToolbar', !toolbarState.showFormattingToolbar)}>
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
