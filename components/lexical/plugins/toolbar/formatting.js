import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND, $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, CAN_UNDO_COMMAND, CAN_REDO_COMMAND, UNDO_COMMAND, REDO_COMMAND, $getRoot, COMMAND_PRIORITY_CRITICAL } from 'lexical'
import { mergeRegister } from '@lexical/utils'
import Bold from '@/svgs/lexical/bold.svg'
import Italic from '@/svgs/lexical/italic.svg'
import Underline from '@/svgs/lexical/underline.svg'
import Strikethrough from '@/svgs/lexical/strikethrough.svg'
import Link from '@/svgs/link.svg'
import Quote from '@/svgs/lexical/quote-text.svg'
import More from '@/svgs/lexical/font-size.svg'
import Undo from '@/svgs/lexical/undo.svg'
import Redo from '@/svgs/lexical/redo.svg'
import styles from '@/components/lexical/theme/theme.module.css'
import Dropdown from 'react-bootstrap/Dropdown'
import { useEffect, useCallback } from 'react'
import classNames from 'classnames'
import { $isCodeNode } from '@lexical/code'
import { useToolbarState } from '../../contexts/toolbar'
import { TOGGLE_LINK_COMMAND, $isLinkNode } from '@lexical/link'
import { getSelectedNode } from '@/components/lexical/utils/selection'

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

function TextOptionsDropdown ({ handleFormat, toolbarState }) {
  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()} className={styles.toolbarItem}>
        <More />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item onClick={() => handleFormat('strikethrough')} className={classNames(styles.dropdownExtraFormatting, toolbarState.isStrikethrough ? styles.active : '')}>
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

/* function $findTopLevelElement (node) {
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
} */

export default function FormattingPlugin () {
  const [editor] = useLexicalComposerContext()

  const { toolbarState, updateToolbarState } = useToolbarState()

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      // get the top level element
      // const anchorNode = selection.anchor.getNode()
      // const element = $findTopLevelElement(anchorNode)
      // const elementKey = element.getKey()
      // const elementDOM = editor.getElementByKey(elementKey)

      // handle links
      const node = getSelectedNode(selection)
      const parent = node.getParent()
      const isLink = $isLinkNode(parent) || $isLinkNode(node)
      updateToolbarState('isLink', isLink)

      // handle general formatting
      updateToolbarState('isBold', selection.hasFormat('bold'))
      updateToolbarState('isItalic', selection.hasFormat('italic'))
      updateToolbarState('isUnderline', selection.hasFormat('underline'))
      updateToolbarState('isStrikethrough', selection.hasFormat('strikethrough'))
      updateToolbarState('isCode', selection.hasFormat('code'))
      updateToolbarState('isQuote', selection.hasFormat('quote'))
      updateToolbarState('isHighlight', selection.hasFormat('highlight'))
      updateToolbarState('isSubscript', selection.hasFormat('subscript'))
      updateToolbarState('isSuperscript', selection.hasFormat('superscript'))
      updateToolbarState('isLowercase', selection.hasFormat('lowercase'))
      updateToolbarState('isUppercase', selection.hasFormat('uppercase'))
      updateToolbarState('isCapitalize', selection.hasFormat('capitalize'))
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

  const handleLink = useCallback(() => {
    console.log('handleLink')
    if (!toolbarState.isLink) {
      // setIsLinkEditMode(true)
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, '')
    } else {
      // setIsLinkEditMode(false)
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
    }
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
      <span className={classNames(styles.toolbarItem, !toolbarState.canUndo ? styles.disabled : '')} onClick={() => editor.dispatchCommand(UNDO_COMMAND)}>
        <Undo />
      </span>
      <span className={classNames(styles.toolbarItem, !toolbarState.canRedo ? styles.disabled : '')} onClick={() => editor.dispatchCommand(REDO_COMMAND)}>
        <Redo />
      </span>
      <span className={styles.divider} />
      <span
        className={classNames(styles.toolbarItem, toolbarState.isBold ? styles.active : '')}
        onClick={() => handleFormat('bold')}
      >
        <Bold />
      </span>

      <span
        className={classNames(styles.toolbarItem, toolbarState.isItalic ? styles.active : '')}
        onClick={() => handleFormat('italic')}
      >
        <Italic />
      </span>

      <span
        className={classNames(styles.toolbarItem, toolbarState.isUnderline ? styles.active : '')}
        style={{ marginTop: '1px' }}
        onClick={() => handleFormat('underline')}
      >
        <Underline />
      </span>
      <span className={styles.divider} />
      <span
        className={classNames(styles.toolbarItem, toolbarState.isLink ? styles.active : '')}
        onClick={handleLink}
      >
        <Link />
      </span>
      <TextOptionsDropdown handleFormat={handleFormat} toolbarState={toolbarState} />
    </div>
  )
}
