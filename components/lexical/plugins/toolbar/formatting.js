import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_CRITICAL, $isElementNode, FORMAT_ELEMENT_COMMAND, OUTDENT_CONTENT_COMMAND, INDENT_CONTENT_COMMAND } from 'lexical'
import { mergeRegister } from '@lexical/utils'
import Link from '@/svgs/link.svg'
import More from '@/svgs/lexical/font-size.svg'
import styles from '@/components/lexical/theme/theme.module.css'
import Dropdown from 'react-bootstrap/Dropdown'
import { useEffect, useCallback } from 'react'
import classNames from 'classnames'
import { useToolbarState } from '../../contexts/toolbar'
import { getShortcutCombo } from '@/components/lexical/plugins/shortcuts/keyboard-shortcuts'
import { snHasFormat, snHasLink } from '@/components/lexical/universal/utils'
import { SN_TOGGLE_LINK_COMMAND } from '@/components/lexical/universal/commands/links'
import { SN_FORMAT_TEXT_COMMAND } from '@/components/lexical/universal/commands/formatting'
import { getSelectedNode } from '@/components/lexical/utils/selection'
import { BLOCK_OPTIONS, FORMAT_OPTIONS, ADDITIONAL_FORMAT_OPTIONS, ALIGN_OPTIONS } from './defs/formatting'
import ArrowDownIcon from '@/svgs/arrow-down-s-line.svg'

function BlockOptionsDropdown ({ toolbarState, handleBlock }) {
  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarItem}>
        <More />
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
        <More />
        <ArrowDownIcon />
      </Dropdown.Toggle>
      <Dropdown.Menu className={styles.dropdownExtra}>
        {ALIGN_OPTIONS.map((option) => (
          <Dropdown.Item
            key={option.action}
            title={`${option.name} (${getShortcutCombo(option.action)})`}
            onClick={() => handleAlign(option.action)}
            className={classNames(styles.dropdownExtraItem, option.action !== 'indent-decrease' && option.action !== 'indent-increase' && toolbarState.elementFormat === option.action ? styles.active : '')}
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

export default function FormattingTools () {
  const [editor] = useLexicalComposerContext()
  const { toolbarState, updateToolbarState } = useToolbarState()

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection)
      const parent = node.getParent()

      updateToolbarState('isLink', snHasLink(selection))
      updateToolbarState('elementFormat', $isElementNode(node) ? node.getFormatType() : parent?.getFormatType() || 'left')
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
    }
  }, [])

  const handleBlock = useCallback((block) => {
    editor.dispatchCommand(SN_FORMAT_TEXT_COMMAND, block)
  }, [editor])

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
