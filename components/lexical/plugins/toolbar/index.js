import styles from '@/components/lexical/theme/theme.module.css'
import { useCallback, useEffect, useRef, useState, useLayoutEffect, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import FormattingTools from './formatting'
import ActionTooltip from '@/components/action-tooltip'
import { useLexicalPreferences } from '@/components/lexical/contexts/preferences'
import { SN_UPLOAD_FILES_COMMAND } from '@/components/lexical/universal/commands/upload'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { getShortcutCombo } from '@/components/lexical/extensions/core/shortcuts/keyboard'
import UploadIcon from '@/svgs/lexical/inserts/paperclip.svg'
import { useToolbarState } from '@/components/lexical/contexts/toolbar'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import { $getSelection, $isRangeSelection, $isNodeSelection, $isElementNode, $isRootOrShadowRoot, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_CRITICAL } from 'lexical'
import { snHasFormat, snHasLink, snGetElementFormat, snGetBlockType, snGetCodeLanguage } from '@/components/lexical/universal/utils/formatting'
import { $getNearestNodeOfType, $findMatchingParent, mergeRegister } from '@lexical/utils'
import { ListNode } from '@lexical/list'
import { $isHeadingNode } from '@lexical/rich-text'
import { $isCodeNode } from '@lexical/code'
import { normalizeCodeLanguage } from '@lexical/code-shiki'
import classNames from 'classnames'
import { ToolbarIcon } from './defs/formatting'
import ArrowDownIcon from '@/svgs/arrow-down-s-line.svg'
import Dropdown from 'react-bootstrap/Dropdown'

// escapes the overflow rules of the FormattingTools component
export const MenuAlternateDimension = forwardRef(({ children, style, className }, ref) => {
  return createPortal(
    <div ref={ref} style={style} className={className}>
      {children}
    </div>,
    document.body
  )
})

function DropdownMenuItem ({ option, isActive, onClick }) {
  const shortcut = getShortcutCombo(option.id)
  return (
    <Dropdown.Item
      key={option.id}
      title={`${option.name} ${shortcut}`}
      onClick={onClick}
      className={classNames(styles.dropdownExtraItem, isActive ? styles.active : '')}
      onPointerDown={e => e.preventDefault()}
      suppressHydrationWarning
    >
      <span className={styles.dropdownExtraItemLabel}>
        <ToolbarIcon id={option.id} />
        <span className={styles.dropdownExtraItemText}>{option.name}</span>
      </span>
      <span className={styles.dropdownExtraItemShortcut} suppressHydrationWarning>
        {shortcut}
      </span>
    </Dropdown.Item>
  )
}

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
              onClick={() => option.handler({ editor })}
            />
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </ActionTooltip>
  )
}

export function ToolbarButton ({ id, isActive, onClick, tooltip, disabled = false, showDelay = 500 }) {
  return (
    <ActionTooltip notForm overlayText={tooltip} placement='top' noWrapper showDelay={showDelay} transition disable={disabled}>
      <span
        title={tooltip}
        className={classNames(styles.toolbarItem, isActive ? styles.active : '')}
        onPointerDown={e => e.preventDefault()}
        onClick={onClick}
      >
        <ToolbarIcon id={id} state={isActive && 'active'} />
      </span>
    </ActionTooltip>
  )
}

function $findTopLevelElement (node) {
  let topLevelElement = node.getKey() === 'root'
    ? node
    : $findMatchingParent(node, (e) => {
      const parent = e.getParent()
      return parent !== null && $isRootOrShadowRoot(parent)
    })

  if (topLevelElement === null) {
    topLevelElement = node.getTopLevelElementOrThrow()
  }

  return topLevelElement
}

export function ToolbarPlugin ({ topLevel }) {
  const [editor] = useLexicalComposerContext()
  const { prefs } = useLexicalPreferences()
  const { batchUpdateToolbarState } = useToolbarState()
  const toolbarRef = useRef(null)

  const [showToolbar, setShowToolbar] = useState(prefs.showToolbar || topLevel)
  const [hasOverflow, setHasOverflow] = useState(false)

  const $updateToolbar = useCallback(() => {
    // markdown mode doesn't support toolbar updates
    if ($isMarkdownMode()) {
      return batchUpdateToolbarState({ markdownMode: true })
    }

    const updates = {}
    updates.markdownMode = false

    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      updates.elementFormat = snGetElementFormat(selection)
      updates.isLink = snHasLink(selection)
      updates.isBold = snHasFormat(selection, 'bold')
      updates.isItalic = snHasFormat(selection, 'italic')
      updates.isUnderline = snHasFormat(selection, 'underline')
      updates.isStrikethrough = snHasFormat(selection, 'strikethrough')
      updates.isCode = snHasFormat(selection, 'code')
      updates.isHighlight = snHasFormat(selection, 'highlight')
      updates.isSubscript = snHasFormat(selection, 'subscript')
      updates.isSuperscript = snHasFormat(selection, 'superscript')
      updates.isLowercase = snHasFormat(selection, 'lowercase')
      updates.isUppercase = snHasFormat(selection, 'uppercase')
      updates.isCapitalize = snHasFormat(selection, 'capitalize')
      updates.blockType = snGetBlockType({ selection, editor })
      // useful?
      updates.codeLanguage = snGetCodeLanguage({ selection, editor })
    }

    if ($isNodeSelection(selection)) {
      const nodes = selection.getNodes()
      for (const selectedNode of nodes) {
        const parentList = $getNearestNodeOfType(selectedNode, ListNode)
        if (parentList) {
          const type = parentList.getListType()
          updates.blockType = type
        } else {
          const selectedElement = $findTopLevelElement(selectedNode)
          updates.blockType = $handleHeadingNode(selectedElement)
          updates.codeLanguage = $handleCodeNode(selectedElement)
          if ($isElementNode(selectedElement)) {
            updates.elementFormat = selectedElement.getFormatType()
          }
        }
      }
    }

    batchUpdateToolbarState(updates)
  }, [])

  const $handleHeadingNode = useCallback((selectedElement) => {
    const type = $isHeadingNode(selectedElement) ? selectedElement.getTag() : selectedElement.getType()
    if (type) {
      return type
    }
  }, [])

  // TODO: support user setting to disable code highlighting? if we ever want to introduce that.
  const $handleCodeNode = useCallback((element) => {
    if ($isCodeNode(element)) {
      const language = element.getLanguage()
      return language ? normalizeCodeLanguage(language) || language : ''
    }
  }, [])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => { $updateToolbar() }, { editor })
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, _newEditor) => {
          $updateToolbar()
          return false
        },
        COMMAND_PRIORITY_CRITICAL
      )
    )
  }, [editor, $updateToolbar])

  // overflow detection for mobile devices
  useLayoutEffect(() => {
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
      <FormattingTools className={!showToolbar && styles.hidden} toolbarRef={toolbarRef} hasOverflow={hasOverflow} />
      <div className='ms-auto d-flex align-items-center'>
        <ActionTooltip notForm overlayText={showToolbar ? 'hide toolbar' : 'show toolbar'} noWrapper placement='top' showDelay={1000} transition>
          <span className={styles.toolbarItem} onClick={() => setShowToolbar(!showToolbar)}>
            <ArrowDownIcon style={{ transform: showToolbar ? 'rotate(90deg)' : '' }} />
          </span>
        </ActionTooltip>
        <ActionTooltip notForm overlayText={`upload files ${getShortcutCombo('upload')}`} placement='top' noWrapper showDelay={500} transition suppressHydrationWarning>
          <span
            title={`upload files ${getShortcutCombo('upload')}`}
            className={styles.toolbarItem}
            onClick={() => editor.dispatchCommand(SN_UPLOAD_FILES_COMMAND)}
            onPointerDown={e => e.preventDefault()}
            suppressHydrationWarning
          >
            <UploadIcon />
          </span>
        </ActionTooltip>
      </div>
    </div>
  )
}
