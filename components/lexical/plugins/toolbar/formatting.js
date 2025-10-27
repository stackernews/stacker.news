import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection, $isRootOrShadowRoot, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_CRITICAL, $isElementNode, OUTDENT_CONTENT_COMMAND, INDENT_CONTENT_COMMAND, $isNodeSelection } from 'lexical'
import { $getNearestNodeOfType, mergeRegister, $findMatchingParent } from '@lexical/utils'
import { $isHeadingNode } from '@lexical/rich-text'
import { $isCodeNode } from '@lexical/code'
import { normalizeCodeLanguage } from '@lexical/code-shiki'
import { ListNode } from '@lexical/list'
import Link from '@/svgs/lexical/link.svg'
import LinkUnlink from '@/svgs/lexical/link-unlink.svg'
import More from '@/svgs/lexical/font-size.svg'
import styles from '@/components/lexical/theme/theme.module.css'
import Dropdown from 'react-bootstrap/Dropdown'
import { useEffect, useCallback, useState, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import classNames from 'classnames'
import { useToolbarState } from '../../contexts/toolbar'
import { getShortcutCombo } from '@/components/lexical/extensions/core/shortcuts/keyboard'
import { snHasFormat, snHasLink, snGetElementFormat, snGetBlockType, snGetCodeLanguage } from '@/components/lexical/universal/utils/formatting'
import { SN_TOGGLE_LINK_COMMAND } from '@/components/lexical/universal/commands/links'
import { SN_FORMAT_TEXT_COMMAND } from '@/components/lexical/universal/commands/formatting/inline'
import { SN_FORMAT_BLOCK_COMMAND } from '@/components/lexical/universal/commands/formatting/blocks'
import { SN_FORMAT_ELEMENT_COMMAND } from '@/components/lexical/universal/commands/formatting/elements'
import { BLOCK_OPTIONS, FORMAT_OPTIONS, ADDITIONAL_FORMAT_OPTIONS, ALIGN_OPTIONS, INDENT_OPTIONS } from './defs/formatting'
import ArrowDownIcon from '@/svgs/arrow-down-s-line.svg'
import AlignLeftIcon from '@/svgs/lexical/align/align-left.svg'
import ActionTooltip from '@/components/action-tooltip'

// escapes the overflow rules of the FormattingTools component
export const MenuAlternateDimension = forwardRef(({ children, style, className }, ref) => {
  return createPortal(
    <div ref={ref} style={style} className={className}>
      {children}
    </div>,
    document.body
  )
})

function BlockOptionsDropdown ({ toolbarState, handleBlock }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const blockOption = BLOCK_OPTIONS.find(option => option.action === toolbarState.blockType)
  return (
    <ActionTooltip notForm overlayText={<>block options <strong>{toolbarState.blockType}</strong></>} placement='top' noWrapper showDelay={500} transition disable={dropdownOpen}>
      <Dropdown drop='up' className='pointer' as='span' onToggle={(isOpen) => setDropdownOpen(isOpen)} show={dropdownOpen}>
        <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={classNames(styles.toolbarItem, dropdownOpen ? styles.active : '')}>
          {blockOption?.icon || <More />}
          <ArrowDownIcon />
        </Dropdown.Toggle>
        <Dropdown.Menu className={styles.dropdownExtra} as={MenuAlternateDimension}>
          {BLOCK_OPTIONS.map((option) => (
            <Dropdown.Item
              key={option.action}
              title={`${option.name} ${getShortcutCombo(option.action)}`}
              onClick={() => handleBlock(option.action)}
              className={classNames(styles.dropdownExtraItem, toolbarState.blockType === option.action ? styles.active : '')}
              onPointerDown={e => e.preventDefault()}
            >
              <span className={styles.dropdownExtraItemLabel}>
                {option.icon}
                <span className={styles.dropdownExtraItemText}>{option.name}</span>
              </span>
              <span className={styles.dropdownExtraItemShortcut}>
                {getShortcutCombo(option.action)}
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

function InlineFormattingOptions ({ toolbarState, handleFormat, isFloating }) {
  return (
    FORMAT_OPTIONS.map((option) => (
      <ActionTooltip notForm overlayText={`${option.name} ${getShortcutCombo(option.action)}`} placement='top' noWrapper key={option.action} showDelay={500} transition disable={isFloating}>
        <span
          title={`${option.name} (${getShortcutCombo(option.action)})`}
          className={classNames(styles.toolbarItem, getFormatToolbarState(toolbarState, option.action) ? styles.active : '')}
          style={option.style}
          onClick={() => handleFormat(option.action)}
          onPointerDown={e => e.preventDefault()}
        >
          {option.icon}
        </span>
      </ActionTooltip>
    ))
  )
}

function AdditionalFormattingOptionsDropdown ({ toolbarState, handleFormat }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <ActionTooltip notForm overlayText={<>additional formatting options</>} placement='top' noWrapper showDelay={500} transition disable={dropdownOpen}>
      <Dropdown className='pointer' as='span' onToggle={(isOpen) => setDropdownOpen(isOpen)} show={dropdownOpen}>
        <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={classNames(styles.toolbarItem, dropdownOpen ? styles.active : '')}>
          <More />
          <ArrowDownIcon />
        </Dropdown.Toggle>
        <Dropdown.Menu className={styles.dropdownExtra} as={MenuAlternateDimension}>
          {ADDITIONAL_FORMAT_OPTIONS.map((option) => (
            <Dropdown.Item
              key={option.action}
              title={`${option.name} ${getShortcutCombo(option.action)}`}
              onClick={() => handleFormat(option.action)}
              className={classNames(styles.dropdownExtraItem, getFormatToolbarState(toolbarState, option.action) ? styles.active : '')}
              onPointerDown={e => e.preventDefault()}
            >
              <span className={styles.dropdownExtraItemLabel}>
                {option.icon}
                <span className={styles.dropdownExtraItemText}>{option.name}</span>
              </span>
              <span className={styles.dropdownExtraItemShortcut}>
                {getShortcutCombo(option.action)}
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </ActionTooltip>
  )
}

function AlignOptionsDropdown ({ toolbarState, handleAlign, handleIndent }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <ActionTooltip notForm overlayText={<>align options <strong>{toolbarState.elementFormat || 'left'}</strong></>} placement='top' noWrapper showDelay={500} transition disable={dropdownOpen}>
      <Dropdown className='pointer' as='span' onToggle={(isOpen) => setDropdownOpen(isOpen)} show={dropdownOpen}>
        <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={classNames(styles.toolbarItem, dropdownOpen ? styles.active : '')}>
          {/* a mess, clean this up */}
          {ALIGN_OPTIONS.find(option => option.action === toolbarState.elementFormat)?.icon || <AlignLeftIcon />}
          <ArrowDownIcon />
        </Dropdown.Toggle>
        <Dropdown.Menu className={styles.dropdownExtra} as={MenuAlternateDimension}>
          {ALIGN_OPTIONS.map((option) => (
            <Dropdown.Item
              key={option.action}
              title={`${option.name} ${getShortcutCombo(option.action)}`}
              onClick={() => handleAlign(option.action)}
              className={classNames(styles.dropdownExtraItem, toolbarState.elementFormat === option.action ? styles.active : '')}
              onPointerDown={e => e.preventDefault()}
            >
              <span className={styles.dropdownExtraItemLabel}>
                {option.icon}
                <span className={styles.dropdownExtraItemText}>{option.name}</span>
              </span>
              <span className={styles.dropdownExtraItemShortcut}>
                {getShortcutCombo(option.action)}
              </span>
            </Dropdown.Item>
          ))}
          {INDENT_OPTIONS.map((option) => (
            <Dropdown.Item
              key={option.action}
              title={`${option.name} ${getShortcutCombo(option.action)}`}
              onClick={() => handleIndent(option.action)}
              className={styles.dropdownExtraItem}
              onPointerDown={e => e.preventDefault()}
            >
              <span className={styles.dropdownExtraItemLabel}>
                {option.icon}
                <span className={styles.dropdownExtraItemText}>{option.name}</span>
              </span>
              <span className={styles.dropdownExtraItemShortcut}>
                {getShortcutCombo(option.action)}
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
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
    const updates = {}
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

  const handleBlock = useCallback((block) => {
    editor.dispatchCommand(SN_FORMAT_BLOCK_COMMAND, block)
  }, [editor, toolbarState.blockType])

  const handleFormat = useCallback((format) => {
    editor.dispatchCommand(SN_FORMAT_TEXT_COMMAND, format)
  }, [editor])

  const handleLink = useCallback(() => {
    editor.dispatchCommand(
      SN_TOGGLE_LINK_COMMAND,
      toolbarState.isLink
        ? null
        : ''
    )
  }, [editor, toolbarState.isLink])

  const handleAlign = useCallback((align) => {
    editor.dispatchCommand(SN_FORMAT_ELEMENT_COMMAND, align)
  }, [editor])

  const handleIndent = useCallback((indent) => {
    if (indent === 'indent-decrease') {
      editor.dispatchCommand(OUTDENT_CONTENT_COMMAND)
    } else {
      editor.dispatchCommand(INDENT_CONTENT_COMMAND)
    }
  }, [editor])

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

  return isFloating
    ? (
      <div className={styles.toolbarFormatting}>
        <InlineFormattingOptions toolbarState={toolbarState} handleFormat={handleFormat} isFloating />
        <span className={classNames(styles.divider)} />
        <ActionTooltip notForm overlayText={<>link {getShortcutCombo('link')}</>} placement='top' noWrapper showDelay={500} transition disable={isFloating}>
          <span
            title={'link ' + getShortcutCombo('link')}
            className={classNames(styles.toolbarItem, toolbarState.isLink ? styles.active : '')}
            onPointerDown={e => e.preventDefault()}
            onClick={handleLink}
          >
            {toolbarState.isLink ? <LinkUnlink /> : <Link />}
          </span>
        </ActionTooltip>
      </div>
      )
    : (
      <div className={classNames(styles.toolbarFormatting, className)}>
        <BlockOptionsDropdown toolbarState={toolbarState} handleBlock={handleBlock} />
        <span className={classNames(styles.divider)} />
        <InlineFormattingOptions toolbarState={toolbarState} handleFormat={handleFormat} />
        <ActionTooltip notForm overlayText={<>link {getShortcutCombo('link')}</>} placement='top' noWrapper showDelay={500} transition>
          <span
            title={'link ' + getShortcutCombo('link')}
            className={classNames(styles.toolbarItem, toolbarState.isLink ? styles.active : '')}
            onPointerDown={e => e.preventDefault()}
            onClick={handleLink}
          >
            {toolbarState.isLink ? <LinkUnlink /> : <Link />}
          </span>
        </ActionTooltip>
        <span className={classNames(styles.divider)} />
        <AdditionalFormattingOptionsDropdown toolbarState={toolbarState} handleFormat={handleFormat} />
        <AlignOptionsDropdown toolbarState={toolbarState} handleAlign={handleAlign} handleIndent={handleIndent} />
      </div>
      )
}

export function useMediaQuery (query) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (e) => setMatches(e.matches)
    mediaQuery.addEventListener('change', handler)

    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

export function useIsMobile () {
  return useMediaQuery('(max-width: 768px)')
}
