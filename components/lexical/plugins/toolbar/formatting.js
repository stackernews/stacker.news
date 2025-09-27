import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND, $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND, CAN_UNDO_COMMAND, CAN_REDO_COMMAND, UNDO_COMMAND, REDO_COMMAND, $getRoot } from 'lexical'
import { mergeRegister } from '@lexical/utils'
import Bold from '@/svgs/lexical/bold.svg'
import Italic from '@/svgs/lexical/italic.svg'
import Underline from '@/svgs/lexical/underline.svg'
import Strikethrough from '@/svgs/lexical/strikethrough.svg'
import Code from '@/svgs/lexical/code-view.svg'
import Quote from '@/svgs/lexical/quote-text.svg'
import More from '@/svgs/lexical/font-size.svg'
import Undo from '@/svgs/lexical/undo.svg'
import Redo from '@/svgs/lexical/redo.svg'
import styles from '@/components/lexical/theme/theme.module.css'
import Dropdown from 'react-bootstrap/Dropdown'
import { useState, useEffect, useCallback } from 'react'
import classNames from 'classnames'
import { $isCodeNode } from '@lexical/code'

function toggleInlineMarkdown (selection, marker) {
  if (!selection) return
  if (selection.isCollapsed()) {
    selection.insertText(marker + marker)
    const { anchor } = selection
    const node = anchor.getNode()
    const offset = anchor.offset
    selection.setTextNodeRange(node, offset - marker.length, node, offset - marker.length)
  } else {
    const text = selection.getTextContent()
    const hasWrap = text.startsWith(marker) && text.endsWith(marker)
    const newText = hasWrap ? text.slice(marker.length, text.length - marker.length) : marker + text + marker
    selection.insertText(newText)
  }
}

function toggleBlockQuote (selection) {
  if (!selection) return
  const text = selection.getTextContent()
  const lines = text.split('\n')
  const allQuoted = lines.every(l => l.startsWith('> '))
  const newLines = allQuoted
    ? lines.map(l => l.replace(/^> /, ''))
    : lines.map(l => (l.length ? `> ${l}` : l))
  selection.insertText(newLines.join('\n'))
}

function wrapWithTag (selection, tag) {
  if (!selection) return
  const before = `<${tag}>`
  const after = `</${tag}>`
  if (selection.isCollapsed()) {
    selection.insertText(before + after)
    const { anchor } = selection
    const node = anchor.getNode()
    const offset = anchor.offset
    selection.setTextNodeRange(node, offset - after.length, node, offset - after.length)
  } else {
    const text = selection.getTextContent()
    const hasWrap = text.startsWith(before) && text.endsWith(after)
    const newText = hasWrap ? text.slice(before.length, text.length - after.length) : before + text + after
    selection.insertText(newText)
  }
}

function TextOptionsDropdown ({ handleFormat, isStrikethrough }) {
  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarItem}>
        <More />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item onClick={() => handleFormat('strikethrough')} className={classNames(styles.dropdownExtraFormatting, isStrikethrough ? styles.active : '')}>
          <span>
            <Strikethrough />
            Strikethrough
          </span>
          <span className='text-muted'>
            ⌘+Shift+X
          </span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => handleFormat('quote')} className={styles.dropdownExtraFormatting}>
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
  const [isCode, setIsCode] = useState(false)

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setIsUnderline(selection.hasFormat('underline'))
      setIsStrikethrough(selection.hasFormat('strikethrough'))
      setIsCode(selection.hasFormat('code'))
    }
  }, [])

  const inMarkdownMode = useCallback(() => {
    console.log('inMarkdownMode')
    return editor.read(() => {
      const root = $getRoot()
      const firstChild = root.getFirstChild()
      console.log('firstChild', firstChild)
      return $isCodeNode(firstChild) && firstChild.getLanguage() === 'markdown'
    })
  }, [editor])

  const handleFormat = useCallback((format) => {
    console.log('handleFormat', format)
    console.log('inMarkdownMode', inMarkdownMode())
    if (!inMarkdownMode()) {
      console.log('format', format)
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
      return
    }
    editor.update(() => {
      console.log('update')
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      switch (format) {
        case 'bold': toggleInlineMarkdown(selection, '**'); break
        case 'italic': toggleInlineMarkdown(selection, '*'); break
        // what about code blocks?
        case 'code': toggleInlineMarkdown(selection, '`'); break
        case 'strikethrough': toggleInlineMarkdown(selection, '~~'); break
        case 'quote': toggleBlockQuote(selection); break
        // not that Shiki actually supports this, we'll need to go custom for this
        case 'underline': wrapWithTag(selection, 'u'); break
        default: break
      }
    })
  }, [editor, inMarkdownMode])

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
        onClick={() => handleFormat('bold')}
      >
        <Bold />
      </span>

      <span
        className={classNames(styles.toolbarItem, isItalic ? styles.active : '')}
        onClick={() => handleFormat('italic')}
      >
        <Italic />
      </span>

      <span
        className={classNames(styles.toolbarItem, isUnderline ? styles.active : '')}
        style={{ marginTop: '1px' }}
        onClick={() => handleFormat('underline')}
      >
        <Underline />
      </span>

      <span
        className={classNames(styles.toolbarItem, isCode ? styles.active : '')}
        onClick={() => handleFormat('code')}
      >
        <Code />
      </span>
      <span className={styles.divider} />
      <TextOptionsDropdown handleFormat={handleFormat} isStrikethrough={isStrikethrough} />
    </div>
  )
}
