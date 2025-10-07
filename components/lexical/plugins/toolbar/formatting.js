import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection, $isRootOrShadowRoot, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_CRITICAL, $isElementNode, FORMAT_ELEMENT_COMMAND, OUTDENT_CONTENT_COMMAND, INDENT_CONTENT_COMMAND, $isNodeSelection } from 'lexical'
import { $getNearestNodeOfType, mergeRegister, $findMatchingParent } from '@lexical/utils'
import { $isHeadingNode } from '@lexical/rich-text'
import { $isCodeNode } from '@lexical/code'
import { normalizeCodeLanguage } from '@lexical/code-shiki'
import { $isListNode, ListNode } from '@lexical/list'
import { $isLinkNode } from '@lexical/link'
import Link from '@/svgs/link.svg'
import More from '@/svgs/lexical/font-size.svg'
import styles from '@/components/lexical/theme/theme.module.css'
import Dropdown from 'react-bootstrap/Dropdown'
import { useEffect, useCallback, useState } from 'react'
import classNames from 'classnames'
import { useToolbarState } from '../../contexts/toolbar'
import { getShortcutCombo } from '@/components/lexical/plugins/shortcuts/keyboard-shortcuts'
import { snHasFormat, snHasLink } from '@/components/lexical/universal/utils'
import { SN_TOGGLE_LINK_COMMAND } from '@/components/lexical/universal/commands/links'
import { SN_FORMAT_TEXT_COMMAND, SN_FORMAT_BLOCK_COMMAND } from '@/components/lexical/universal/commands/formatting'
import { getSelectedNode } from '@/components/lexical/utils/selection'
import { BLOCK_OPTIONS, FORMAT_OPTIONS, ADDITIONAL_FORMAT_OPTIONS, ALIGN_OPTIONS, INDENT_OPTIONS } from './defs/formatting'
import ArrowDownIcon from '@/svgs/arrow-down-s-line.svg'
import AlignLeftIcon from '@/svgs/lexical/align/align-left.svg'

function BlockOptionsDropdown ({ toolbarState, handleBlock }) {
  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarItem}>
        {BLOCK_OPTIONS.find(option => option.action === toolbarState.blockType)?.icon || <More />}
        <ArrowDownIcon />
      </Dropdown.Toggle>
      <Dropdown.Menu className={styles.dropdownExtra}>
        {BLOCK_OPTIONS.map((option) => (
          <Dropdown.Item
            key={option.action}
            title={`${option.name} (${getShortcutCombo(option.action)})`}
            onClick={() => handleBlock(option.action)}
            className={classNames(styles.dropdownExtraItem, toolbarState.elementFormat === option.action ? styles.active : '')}
          >
            <span className={styles.dropdownExtraItemLabel}>
              {option.icon}
              <span className={styles.dropdownExtraItemText}>{option.name}</span>
            </span>
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
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

function InlineFormattingOptions ({ toolbarState, handleFormat }) {
  return (
    FORMAT_OPTIONS.map((option) => (
      <span
        key={option.action}
        title={`${option.name} (${getShortcutCombo(option.action)})`}
        className={classNames(styles.toolbarItem, getFormatToolbarState(toolbarState, option.action) ? styles.active : '')}
        style={option.style}
        onClick={() => handleFormat(option.action)}
      >
        {option.icon}
      </span>
    ))
  )
}

function AdditionalFormattingOptionsDropdown ({ toolbarState, handleFormat }) {
  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarItem}>
        <More />
        <ArrowDownIcon />
      </Dropdown.Toggle>
      <Dropdown.Menu className={styles.dropdownExtra}>
        {ADDITIONAL_FORMAT_OPTIONS.map((option) => (
          <Dropdown.Item
            key={option.action}
            title={`${option.name} (${getShortcutCombo(option.action)})`}
            onClick={() => handleFormat(option.action)}
            className={classNames(styles.dropdownExtraItem, getFormatToolbarState(toolbarState, option.action) ? styles.active : '')}
          >
            <span className={styles.dropdownExtraItemLabel}>
              {option.icon}
              <span className={styles.dropdownExtraItemText}>{option.name}</span>
            </span>
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  )
}

function AlignOptionsDropdown ({ toolbarState, handleAlign, handleIndent }) {
  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarItem}>
        {/* a mess, clean this up */}
        {ALIGN_OPTIONS.find(option => option.action === toolbarState.elementFormat)?.icon || <AlignLeftIcon />}
        <ArrowDownIcon />
      </Dropdown.Toggle>
      <Dropdown.Menu className={styles.dropdownExtra}>
        {ALIGN_OPTIONS.map((option) => (
          <Dropdown.Item
            key={option.action}
            title={`${option.name} (${getShortcutCombo(option.action)})`}
            onClick={() => handleAlign(option.action)}
            className={classNames(styles.dropdownExtraItem, toolbarState.elementFormat === option.action ? styles.active : '')}
          >
            <span className={styles.dropdownExtraItemLabel}>
              {option.icon}
              <span className={styles.dropdownExtraItemText}>{option.name}</span>
            </span>
          </Dropdown.Item>
        ))}
        {INDENT_OPTIONS.map((option) => (
          <Dropdown.Item
            key={option.action}
            title={`${option.name} (${getShortcutCombo(option.action)})`}
            onClick={() => handleIndent(option.action)}
            className={styles.dropdownExtraItem}
          >
            <span className={styles.dropdownExtraItemLabel}>
              {option.icon}
              <span className={styles.dropdownExtraItemText}>{option.name}</span>
            </span>
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
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

export default function FormattingTools () {
  const [editor] = useLexicalComposerContext()
  const [, setSelectedElementKey] = useState(null)
  const { toolbarState, updateToolbarState } = useToolbarState()

  const $handleHeadingNode = useCallback((selectedElement) => {
    const type = $isHeadingNode(selectedElement) ? selectedElement.getTag() : selectedElement.getType()
    if (type) {
      console.log('type', type)
      updateToolbarState('blockType', type)
    }
  }, [updateToolbarState])

  // TODO: support user setting to disable code highlighting? if we ever want to introduce that.
  const $handleCodeNode = useCallback((element) => {
    if ($isCodeNode(element)) {
      const language = element.getLanguage()
      updateToolbarState('codeLanguage', language ? normalizeCodeLanguage(language) || language : '')
    }
  }, [updateToolbarState])

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection)
      const parent = node.getParent()

      let matchingParent
      if ($isLinkNode(parent)) {
        matchingParent = $findMatchingParent(node, (parentNode) => $isElementNode(parentNode) && !parentNode.isInline())
      }

      updateToolbarState(
        'elementFormat',
        $isElementNode(matchingParent)
          ? matchingParent.getFormatType()
          : $isElementNode(node)
            ? node.getFormatType()
            : parent?.getFormatType() || 'left'
      )

      updateToolbarState('isLink', snHasLink(selection))
      updateToolbarState('isBold', snHasFormat(selection, 'bold'))
      updateToolbarState('isItalic', snHasFormat(selection, 'italic'))
      updateToolbarState('isUnderline', snHasFormat(selection, 'underline'))
      updateToolbarState('isStrikethrough', snHasFormat(selection, 'strikethrough'))
      updateToolbarState('isCode', snHasFormat(selection, 'code'))
      updateToolbarState('isQuote', snHasFormat(selection, 'quote'))
      updateToolbarState('isHighlight', snHasFormat(selection, 'highlight'))
      updateToolbarState('isSubscript', snHasFormat(selection, 'subscript'))
      updateToolbarState('isSuperscript', snHasFormat(selection, 'superscript'))
      updateToolbarState('isLowercase', snHasFormat(selection, 'lowercase'))
      updateToolbarState('isUppercase', snHasFormat(selection, 'uppercase'))
      updateToolbarState('isCapitalize', snHasFormat(selection, 'capitalize'))

      const anchorNode = selection.anchor.getNode()
      const element = $findTopLevelElement(anchorNode)
      const elementKey = element.getKey()
      const elementDOM = editor.getElementByKey(elementKey)

      if (elementDOM !== null) {
        setSelectedElementKey(elementKey)
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode)
          const type = parentList ? parentList.getListType() : element.getListType()
          console.log('type', type)
          updateToolbarState('blockType', type)
        } else {
          $handleHeadingNode(element)
          $handleCodeNode(element)
        }
      }
    }

    if ($isNodeSelection(selection)) {
      const nodes = selection.getNodes()
      for (const selectedNode of nodes) {
        const parentList = $getNearestNodeOfType(selectedNode, ListNode)
        if (parentList) {
          const type = parentList.getListType()
          console.log('type', type)
          updateToolbarState('blockType', type)
        } else {
          const selectedElement = $findTopLevelElement(selectedNode)
          $handleHeadingNode(selectedElement)
          $handleCodeNode(selectedElement)
          if ($isElementNode(selectedElement)) {
            updateToolbarState('elementFormat', selectedElement.getFormatType())
          }
        }
      }
    }
  }, [])

  const handleBlock = useCallback((block) => {
    console.log('handleBlock', block)
    console.log('toolbarState.blockType', toolbarState.blockType)
    editor.dispatchCommand(SN_FORMAT_BLOCK_COMMAND, { activeBlock: toolbarState.blockType, block })
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
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align)
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

  return (
    <div className={styles.toolbarFormatting}>
      <BlockOptionsDropdown toolbarState={toolbarState} handleBlock={handleBlock} />
      <span className={styles.divider} />
      <InlineFormattingOptions toolbarState={toolbarState} handleFormat={handleFormat} />
      <span className={styles.divider} />
      <span
        title={'link (' + getShortcutCombo('link') + ')'}
        className={classNames(styles.toolbarItem, toolbarState.isLink ? styles.active : '')}
        onClick={handleLink}
      >
        <Link />
      </span>
      <span className={styles.divider} />
      <AdditionalFormattingOptionsDropdown toolbarState={toolbarState} handleFormat={handleFormat} />
      <span className={styles.divider} />
      <AlignOptionsDropdown toolbarState={toolbarState} handleAlign={handleAlign} handleIndent={handleIndent} />
    </div>
  )
}
