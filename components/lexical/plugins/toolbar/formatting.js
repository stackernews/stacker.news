import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND, $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND, CAN_UNDO_COMMAND, CAN_REDO_COMMAND, UNDO_COMMAND, REDO_COMMAND } from 'lexical'
import { mergeRegister } from '@lexical/utils'
import Bold from '@/svgs/lexical/bold.svg'
import Italic from '@/svgs/lexical/italic.svg'
import Underline from '@/svgs/lexical/underline.svg'
import Strikethrough from '@/svgs/lexical/strikethrough.svg'
import Code from '@/svgs/lexical/code-view.svg'
import Link from '@/svgs/lexical/link.svg'
import Quote from '@/svgs/lexical/quote-text.svg'
import More from '@/svgs/lexical/font-size.svg'
import Undo from '@/svgs/lexical/undo.svg'
import Redo from '@/svgs/lexical/redo.svg'
import styles from '../../styles/theme.module.css'
import Dropdown from 'react-bootstrap/Dropdown'
import { useState, useEffect, useCallback } from 'react'
import classNames from 'classnames'

function TextOptionsDropdown ({ editor, isStrikethrough }) {
  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarItem}>
        <More />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')} className={classNames(styles.dropdownExtraFormatting, isStrikethrough ? styles.active : '')}>
          <span>
            <Strikethrough />
            Strikethrough
          </span>
          <span className='text-muted'>
            ⌘+Shift+X
          </span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'quote')} className={styles.dropdownExtraFormatting}>
          <span>
            <Quote />
            Quote
          </span>
          <span className='text-muted'>
            ⌘+Shift+X
          </span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}

export default function FormattingPlugin () {
  const [editor] = useLexicalComposerContext()
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [isStrikethrough, setIsStrikethrough] = useState(false)

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setIsUnderline(selection.hasFormat('underline'))
      setIsStrikethrough(selection.hasFormat('strikethrough'))
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
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload)
          return false
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload)
          return false
        },
        COMMAND_PRIORITY_LOW
      )
    )
  }, [editor, $updateToolbar])

  return (
    <div className={styles.toolbarFormatting}>
      <span className={classNames(styles.toolbarItem, !canUndo ? styles.disabled : '')} onClick={() => editor.dispatchCommand(UNDO_COMMAND)}>
        <Undo />
      </span>
      <span className={classNames(styles.toolbarItem, !canRedo ? styles.disabled : '')} onClick={() => editor.dispatchCommand(REDO_COMMAND)}>
        <Redo />
      </span>
      <span className={styles.divider} />
      <span
        className={classNames(styles.toolbarItem, isBold ? styles.active : '')}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
      >
        <Bold />
      </span>

      <span
        className={classNames(styles.toolbarItem, isItalic ? styles.active : '')}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
      >
        <Italic />
      </span>

      <span
        className={classNames(styles.toolbarItem, isUnderline ? styles.active : '')}
        style={{ marginTop: '1px' }}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
      >
        <Underline />
      </span>

      <span
        className={classNames(styles.toolbarItem)}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
      >
        <Code />
      </span>

      <span
        className={classNames(styles.toolbarItem, styles.toolbarItemLink)}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'link')}
      >
        <Link />
      </span>
      <span className={styles.divider} />
      <TextOptionsDropdown editor={editor} isStrikethrough={isStrikethrough} />
    </div>
  )
}
