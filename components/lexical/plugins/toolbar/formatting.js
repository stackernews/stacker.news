import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection, $isRootOrShadowRoot, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_CRITICAL, $isElementNode, $isNodeSelection } from 'lexical'
import { $getNearestNodeOfType, mergeRegister, $findMatchingParent } from '@lexical/utils'
import { $isHeadingNode } from '@lexical/rich-text'
import { $isCodeNode } from '@lexical/code'
import { normalizeCodeLanguage } from '@lexical/code-shiki'
import { ListNode } from '@lexical/list'
import Link from '@/svgs/lexical/link.svg'
import LinkUnlink from '@/svgs/lexical/link-unlink.svg'
import More from '@/svgs/lexical/font-style.svg'
import styles from '@/components/lexical/theme/theme.module.css'
import Dropdown from 'react-bootstrap/Dropdown'
import { useEffect, useCallback, useState, forwardRef, Fragment } from 'react'
import { createPortal } from 'react-dom'
import classNames from 'classnames'
import { useToolbarState } from '../../contexts/toolbar'
import { getShortcutCombo } from '@/components/lexical/extensions/core/shortcuts/keyboard'
import { snHasFormat, snHasLink, snGetElementFormat, snGetBlockType, snGetCodeLanguage } from '@/components/lexical/universal/utils/formatting'
import { SN_TOGGLE_LINK_COMMAND } from '@/components/lexical/universal/commands/links'
import { BLOCK_OPTIONS, INLINE_OPTIONS, ADDITIONAL_FORMAT_OPTIONS, ALIGN_OPTIONS, INDENT_OPTIONS } from './defs/formatting'
import ArrowDownIcon from '@/svgs/arrow-down-s-line.svg'
import AlignLeftIcon from '@/svgs/lexical/align/align-left.svg'
import ActionTooltip from '@/components/action-tooltip'
import BlocksIcon from '@/svgs/lexical/block/blocks.svg'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import InsertTools from './insert'

// escapes the overflow rules of the FormattingTools component
export const MenuAlternateDimension = forwardRef(({ children, style, className }, ref) => {
  return createPortal(
    <div ref={ref} style={style} className={className}>
      {children}
    </div>,
    document.body
  )
})

function BlockOptionsDropdown ({ editor, toolbarState }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const blockOption = !toolbarState.markdownMode ? BLOCK_OPTIONS.find(option => option.id === toolbarState.blockType) : null
  return (
    <ActionTooltip
      notForm
      overlayText={<>block options{!toolbarState.markdownMode && <><strong> {toolbarState.blockType}</strong></>}</>}
      placement='top'
      noWrapper
      showDelay={500}
      transition
      disable={dropdownOpen}
    >
      <Dropdown drop='up' className='pointer' as='span' onToggle={(isOpen) => setDropdownOpen(isOpen)} show={dropdownOpen}>
        <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={classNames(styles.toolbarItem, dropdownOpen ? styles.active : '')}>
          {blockOption?.icon || <BlocksIcon />}
          <ArrowDownIcon />
        </Dropdown.Toggle>
        <Dropdown.Menu className={styles.dropdownExtra} as={MenuAlternateDimension}>
          {BLOCK_OPTIONS.map((option) => (
            <Dropdown.Item
              key={option.id}
              title={`${option.name} ${getShortcutCombo(option.id)}`}
              onClick={() => option.handler({ editor })}
              className={classNames(styles.dropdownExtraItem, toolbarState.blockType === option.id ? styles.active : '')}
              onPointerDown={e => e.preventDefault()}
            >
              <span className={styles.dropdownExtraItemLabel}>
                {option.icon}
                <span className={styles.dropdownExtraItemText}>{option.name}</span>
              </span>
              <span className={styles.dropdownExtraItemShortcut}>
                {getShortcutCombo(option.id)}
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </ActionTooltip>
  )
}

function getFormatToolbarState (toolbarState, format) {
  switch (format) {
    case 'bold':
      return toolbarState.isBold
    case 'italic':
      return toolbarState.isItalic
    case 'underline':
      return toolbarState.isUnderline
    case 'strikethrough':
      return toolbarState.isStrikethrough
    default:
      return false
  }
}

function InlineFormattingOptions ({ editor, toolbarState, isFloating }) {
  return (
    INLINE_OPTIONS.map((option) => (
      <Fragment key={option.id}>
        <ActionTooltip notForm overlayText={`${option.name} ${getShortcutCombo(option.id)}`} placement='top' noWrapper showDelay={500} transition disable={isFloating}>
          <span
            title={`${option.name} (${getShortcutCombo(option.id)})`}
            className={classNames(styles.toolbarItem, getFormatToolbarState(toolbarState, option.id) ? styles.active : '')}
            style={option.style}
            onClick={() => option.handler({ editor })}
            onPointerDown={e => e.preventDefault()}
          >
            {option.icon}
          </span>
        </ActionTooltip>
        {option.id === 'italic' && <span className={styles.divider} />}
      </Fragment>
    ))
  )
}

function AdditionalFormattingOptionsDropdown ({ editor, toolbarState }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <ActionTooltip notForm overlayText={<>additional formatting options</>} placement='top' noWrapper showDelay={500} transition disable={dropdownOpen}>
      <Dropdown drop='up' className='pointer' as='span' onToggle={(isOpen) => setDropdownOpen(isOpen)} show={dropdownOpen}>
        <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={classNames(styles.toolbarItem, dropdownOpen ? styles.active : '')}>
          <More />
          <ArrowDownIcon />
        </Dropdown.Toggle>
        <Dropdown.Menu className={styles.dropdownExtra} as={MenuAlternateDimension}>
          {ADDITIONAL_FORMAT_OPTIONS.map((option) => (
            <Dropdown.Item
              key={option.id}
              title={`${option.name} ${getShortcutCombo(option.id)}`}
              onClick={() => option.handler({ editor })}
              className={classNames(styles.dropdownExtraItem, getFormatToolbarState(toolbarState, option.id) ? styles.active : '')}
              onPointerDown={e => e.preventDefault()}
            >
              <span className={styles.dropdownExtraItemLabel}>
                {option.icon}
                <span className={styles.dropdownExtraItemText}>{option.name}</span>
              </span>
              <span className={styles.dropdownExtraItemShortcut}>
                {getShortcutCombo(option.id)}
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </ActionTooltip>
  )
}

function AlignOptionsDropdown ({ editor, toolbarState }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const alignOption = !toolbarState.markdownMode ? ALIGN_OPTIONS.find(option => option.id === toolbarState.elementFormat) : null
  return (
    <ActionTooltip notForm overlayText={<>align options{!toolbarState.markdownMode && <><strong> {toolbarState.elementFormat || 'left'}</strong></>}</>} placement='top' noWrapper showDelay={500} transition disable={dropdownOpen}>
      <Dropdown drop='up' className='pointer' as='span' onToggle={(isOpen) => setDropdownOpen(isOpen)} show={dropdownOpen}>
        <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={classNames(styles.toolbarItem, dropdownOpen ? styles.active : '')}>
          {/* a mess, clean this up */}
          {alignOption?.icon || <AlignLeftIcon />}
          <ArrowDownIcon />
        </Dropdown.Toggle>
        <Dropdown.Menu className={styles.dropdownExtra} as={MenuAlternateDimension}>
          {ALIGN_OPTIONS.map((option) => (
            <Dropdown.Item
              key={option.id}
              title={`${option.name} ${getShortcutCombo(option.id)}`}
              onClick={() => option.handler({ editor })}
              className={classNames(styles.dropdownExtraItem, toolbarState.elementFormat === option.id ? styles.active : '')}
              onPointerDown={e => e.preventDefault()}
            >
              <span className={styles.dropdownExtraItemLabel}>
                {option.icon}
                <span className={styles.dropdownExtraItemText}>{option.name}</span>
              </span>
              <span className={styles.dropdownExtraItemShortcut}>
                {getShortcutCombo(option.id)}
              </span>
            </Dropdown.Item>
          ))}
          {INDENT_OPTIONS.map((option) => (
            <Dropdown.Item
              key={option.id}
              title={`${option.name} ${getShortcutCombo(option.id)}`}
              onClick={() => option.handler({ editor })}
              className={styles.dropdownExtraItem}
              onPointerDown={e => e.preventDefault()}
            >
              <span className={styles.dropdownExtraItemLabel}>
                {option.icon}
                <span className={styles.dropdownExtraItemText}>{option.name}</span>
              </span>
              <span className={styles.dropdownExtraItemShortcut}>
                {getShortcutCombo(option.id)}
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </ActionTooltip>
  )
}

function ToolbarButton ({ icon: Icon, activeIcon: ActiveIcon, isActive, onClick, tooltip, disabled = false, showDelay = 500 }) {
  return (
    <ActionTooltip notForm overlayText={tooltip} placement='top' noWrapper showDelay={showDelay} transition disable={disabled}>
      <span
        title={tooltip}
        className={classNames(styles.toolbarItem, isActive ? styles.active : '')}
        onPointerDown={e => e.preventDefault()}
        onClick={onClick}
      >
        {isActive && ActiveIcon ? <ActiveIcon /> : <Icon />}
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

export default function FormattingTools ({ isFloating, className }) {
  const [editor] = useLexicalComposerContext()
  const { toolbarState, batchUpdateToolbarState } = useToolbarState()

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

  const $updateToolbar = useCallback(() => {
    // markdown parsing is expensive, why do it for some toolbar updates?
    const updates = {}
    if ($isMarkdownMode()) {
      return batchUpdateToolbarState({ markdownMode: true })
    } else {
      updates.markdownMode = false
    }

    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      updates.elementFormat = snGetElementFormat(selection)
      updates.isLink = snHasLink(selection)
      updates.isBold = snHasFormat(selection, 'bold')
      updates.isItalic = snHasFormat(selection, 'italic')
      updates.isUnderline = snHasFormat(selection, 'underline')
      updates.isStrikethrough = snHasFormat(selection, 'strikethrough')
      updates.isCode = snHasFormat(selection, 'code')
      updates.isQuote = snHasFormat(selection, 'quote')
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

  const handleLink = useCallback(() => {
    editor.dispatchCommand(
      SN_TOGGLE_LINK_COMMAND,
      toolbarState.isLink
        ? null
        : ''
    )
  }, [editor, toolbarState.isLink])

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

  if (isFloating) {
    return (
      <div className={styles.toolbarFormatting}>
        <InlineFormattingOptions editor={editor} toolbarState={toolbarState} isFloating />
        <ToolbarButton icon={Link} activeIcon={LinkUnlink} isActive={toolbarState.isLink} onClick={handleLink} tooltip={<>link {getShortcutCombo('link')}</>} disabled />
      </div>
    )
  }

  return (
    <div className={classNames(styles.toolbarFormatting, className)}>
      <BlockOptionsDropdown editor={editor} toolbarState={toolbarState} />
      <InlineFormattingOptions editor={editor} toolbarState={toolbarState} />
      <ToolbarButton icon={Link} activeIcon={LinkUnlink} isActive={toolbarState.isLink} onClick={handleLink} tooltip={<>link {getShortcutCombo('link')}</>} />
      <span className={classNames(styles.divider)} />
      <AlignOptionsDropdown editor={editor} toolbarState={toolbarState} />
      <AdditionalFormattingOptionsDropdown editor={editor} toolbarState={toolbarState} />
      <span className={classNames(styles.divider)} />
      <InsertTools />
    </div>
  )
}
