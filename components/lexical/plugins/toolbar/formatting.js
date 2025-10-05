import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, CAN_UNDO_COMMAND, CAN_REDO_COMMAND, COMMAND_PRIORITY_CRITICAL, $isElementNode, FORMAT_ELEMENT_COMMAND, OUTDENT_CONTENT_COMMAND, INDENT_CONTENT_COMMAND } from 'lexical'
import { mergeRegister } from '@lexical/utils'
import Bold from '@/svgs/lexical/bold.svg'
import Italic from '@/svgs/lexical/italic.svg'
import Underline from '@/svgs/lexical/underline.svg'
import Strikethrough from '@/svgs/lexical/strikethrough.svg'
import Link from '@/svgs/link.svg'
import Quote from '@/svgs/lexical/quote-text.svg'
import More from '@/svgs/lexical/font-size.svg'
import styles from '@/components/lexical/theme/theme.module.css'
import Dropdown from 'react-bootstrap/Dropdown'
import AlignLeftIcon from '@/svgs/lexical/align/align-left.svg'
import AlignCenterIcon from '@/svgs/lexical/align/align-center.svg'
import AlignRightIcon from '@/svgs/lexical/align/align-right.svg'
import AlignJustifyIcon from '@/svgs/lexical/align/align-justify.svg'
import IndentDecreaseIcon from '@/svgs/lexical/align/indent-decrease.svg'
import IndentIncreaseIcon from '@/svgs/lexical/align/indent-increase.svg'
import { useEffect, useCallback } from 'react'
import classNames from 'classnames'
import { useToolbarState } from '../../contexts/toolbar'
import { getShortcutCombo } from '@/components/lexical/commands/keyboard-shortcuts'
import { snHasFormat, snHasLink } from '@/components/lexical/universal/utils'
import { SN_TOGGLE_LINK_COMMAND } from '@/components/lexical/universal/commands/links'
import { SN_FORMAT_TEXT_COMMAND } from '@/components/lexical/universal/commands/formatting'
import { getSelectedNode } from '@/components/lexical/utils/selection'
import ArrowDownIcon from '@/svgs/arrow-down-s-line.svg'

function TextOptionsDropdown ({ toolbarState, handleFormat }) {
  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarItem}>
        <More />
        <ArrowDownIcon />
      </Dropdown.Toggle>
      <Dropdown.Menu className={styles.dropdownExtra}>
        <Dropdown.Item title={'Strikethrough (' + getShortcutCombo('strikethrough') + ')'} onClick={() => handleFormat('strikethrough')} className={classNames(styles.dropdownExtraItem, toolbarState.isStrikethrough ? styles.active : '')}>
          <span className={styles.dropdownExtraItemLabel}>
            <Strikethrough />
            <span className={styles.dropdownExtraItemText}>strikethrough</span>
          </span>
          <span className={styles.dropdownExtraItemShortcut}>
            {getShortcutCombo('strikethrough')}
          </span>
        </Dropdown.Item>
        <Dropdown.Item title={'Quote (' + getShortcutCombo('quote') + ')'} onClick={() => handleFormat('quote')} className={styles.dropdownExtraItem}>
          <span className={styles.dropdownExtraItemLabel}>
            <Quote />
            <span className={styles.dropdownExtraItemText}>quote</span>
          </span>
          <span className={styles.dropdownExtraItemShortcut}>
            {getShortcutCombo('quote')}
          </span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}

function AlignOptionsDropdown ({ toolbarState, handleAlign, handleIndent }) {
  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarItem}>
        {/* a mess, clean this up */}
        {toolbarState.elementFormat === 'left' ? <AlignLeftIcon /> : toolbarState.elementFormat === 'center' ? <AlignCenterIcon /> : toolbarState.elementFormat === 'right' ? <AlignRightIcon /> : toolbarState.elementFormat === 'justify' ? <AlignJustifyIcon /> : <IndentDecreaseIcon />}
        <ArrowDownIcon />
      </Dropdown.Toggle>
      <Dropdown.Menu className={styles.dropdownExtra}>
        <Dropdown.Item onClick={() => handleAlign('left')} className={classNames(styles.dropdownExtraItem, toolbarState.elementFormat === 'left' ? styles.active : '')}>
          <span className={styles.dropdownExtraItemLabel}>
            <AlignLeftIcon />
            <span className={styles.dropdownExtraItemText}>left</span>
          </span>
          <span className={styles.dropdownExtraItemShortcut}>
            {getShortcutCombo('align-left')}
          </span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => handleAlign('center')} className={classNames(styles.dropdownExtraItem, toolbarState.elementFormat === 'center' ? styles.active : '')}>
          <span className={styles.dropdownExtraItemLabel}>
            <AlignCenterIcon />
            <span className={styles.dropdownExtraItemText}>center</span>
          </span>
          <span className={styles.dropdownExtraItemShortcut}>
            {getShortcutCombo('align-center')}
          </span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => handleAlign('right')} className={classNames(styles.dropdownExtraItem, toolbarState.elementFormat === 'right' ? styles.active : '')}>
          <span className={styles.dropdownExtraItemLabel}>
            <AlignRightIcon />
            <span className={styles.dropdownExtraItemText}>right</span>
          </span>
          <span className={styles.dropdownExtraItemShortcut}>
            {getShortcutCombo('align-right')}
          </span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => handleAlign('justify')} className={classNames(styles.dropdownExtraItem, toolbarState.elementFormat === 'justify' ? styles.active : '')}>
          <span className={styles.dropdownExtraItemLabel}>
            <AlignJustifyIcon />
            <span className={styles.dropdownExtraItemText}>justify</span>
          </span>
          <span className={styles.dropdownExtraItemShortcut}>
            {getShortcutCombo('align-justify')}
          </span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => handleIndent('indent-decrease')} className={styles.dropdownExtraItem}>
          <span className={styles.dropdownExtraItemLabel}>
            <IndentDecreaseIcon />
            <span className={styles.dropdownExtraItemText}>indent decrease</span>
          </span>
          <span className={styles.dropdownExtraItemShortcut}>
            {getShortcutCombo('indent-decrease')}
          </span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => handleIndent('indent-increase')} className={styles.dropdownExtraItem}>
          <span className={styles.dropdownExtraItemLabel}>
            <IndentIncreaseIcon />
            <span className={styles.dropdownExtraItemText}>indent increase</span>
          </span>
          <span className={styles.dropdownExtraItemShortcut}>
            {getShortcutCombo('indent-increase')}
          </span>
        </Dropdown.Item>
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
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          updateToolbarState('canUndo', payload)
          return false
        },
        COMMAND_PRIORITY_CRITICAL
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          updateToolbarState('canRedo', payload)
          return false
        },
        COMMAND_PRIORITY_CRITICAL
      )
    )
  }, [editor, $updateToolbar])

  return (
    <div className={styles.toolbarFormatting}>
      <span
        title={'bold (' + getShortcutCombo('bold') + ')'}
        className={classNames(styles.toolbarItem, toolbarState.isBold ? styles.active : '')}
        onClick={() => handleFormat('bold')}
      >
        <Bold />
      </span>

      <span
        title={'italic (' + getShortcutCombo('italic') + ')'}
        className={classNames(styles.toolbarItem, toolbarState.isItalic ? styles.active : '')}
        onClick={() => handleFormat('italic')}
      >
        <Italic />
      </span>

      <span
        title={'underline (' + getShortcutCombo('underline') + ')'}
        className={classNames(styles.toolbarItem, toolbarState.isUnderline ? styles.active : '')}
        style={{ marginTop: '1px' }}
        onClick={() => handleFormat('underline')}
      >
        <Underline />
      </span>
      <span className={styles.divider} />
      <span
        title={'link (' + getShortcutCombo('link') + ')'}
        className={classNames(styles.toolbarItem, toolbarState.isLink ? styles.active : '')}
        onClick={handleLink}
      >
        <Link />
      </span>
      <TextOptionsDropdown toolbarState={toolbarState} handleFormat={handleFormat} />
      <AlignOptionsDropdown toolbarState={toolbarState} handleAlign={handleAlign} handleIndent={handleIndent} />
    </div>
  )
}
