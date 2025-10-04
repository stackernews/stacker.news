import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, CAN_UNDO_COMMAND, CAN_REDO_COMMAND, COMMAND_PRIORITY_CRITICAL } from 'lexical'
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
import { useEffect, useCallback } from 'react'
import classNames from 'classnames'
import { useToolbarState } from '../../contexts/toolbar'
import { getShortcutCombo } from '@/components/lexical/commands/keyboard-shortcuts'
import { snHasFormat, snHasLink } from '@/components/lexical/universal/utils'
import { SN_TOGGLE_LINK_COMMAND } from '@/components/lexical/universal/commands/links'
import { SN_FORMAT_TEXT_COMMAND } from '@/components/lexical/universal/commands/formatting'

function TextOptionsDropdown ({ toolbarState, handleFormat }) {
  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarItem}>
        <More />
      </Dropdown.Toggle>
      <Dropdown.Menu className={styles.dropdownExtra}>
        <Dropdown.Item title={'Strikethrough (' + getShortcutCombo('strikethrough') + ')'} onClick={() => handleFormat('strikethrough')} className={classNames(styles.dropdownExtraItem, toolbarState.isStrikethrough ? styles.active : '')}>
          <span>
            <Strikethrough />
            <span className={styles.dropdownExtraItemText}>Strikethrough</span>
          </span>
          <span className={styles.dropdownExtraItemShortcut}>
            {getShortcutCombo('strikethrough')}
          </span>
        </Dropdown.Item>
        <Dropdown.Item title={'Quote (' + getShortcutCombo('quote') + ')'} onClick={() => handleFormat('quote')} className={styles.dropdownExtraItem}>
          <span>
            <Quote />
            <span className={styles.dropdownExtraItemText}>Quote</span>
          </span>
          <span className={styles.dropdownExtraItemShortcut}>
            {getShortcutCombo('quote')}
          </span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}

export default function FormattingPlugin () {
  const [editor] = useLexicalComposerContext()
  const { toolbarState, updateToolbarState } = useToolbarState()

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
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
        title={'Bold (' + getShortcutCombo('bold') + ')'}
        className={classNames(styles.toolbarItem, toolbarState.isBold ? styles.active : '')}
        onClick={() => handleFormat('bold')}
      >
        <Bold />
      </span>

      <span
        title={'Italic (' + getShortcutCombo('italic') + ')'}
        className={classNames(styles.toolbarItem, toolbarState.isItalic ? styles.active : '')}
        onClick={() => handleFormat('italic')}
      >
        <Italic />
      </span>

      <span
        title={'Underline (' + getShortcutCombo('underline') + ')'}
        className={classNames(styles.toolbarItem, toolbarState.isUnderline ? styles.active : '')}
        style={{ marginTop: '1px' }}
        onClick={() => handleFormat('underline')}
      >
        <Underline />
      </span>
      <span className={styles.divider} />
      <span
        title={'Link (' + getShortcutCombo('link') + ')'}
        className={classNames(styles.toolbarItem, toolbarState.isLink ? styles.active : '')}
        onClick={handleLink}
      >
        <Link />
      </span>
      <TextOptionsDropdown toolbarState={toolbarState} handleFormat={handleFormat} />
    </div>
  )
}
