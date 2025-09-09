import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND, $getSelection, $isRangeSelection } from 'lexical'
import Bold from '@/svgs/lexical/bold.svg'
import Italic from '@/svgs/lexical/italic.svg'
import Underline from '@/svgs/lexical/underline.svg'
import Strikethrough from '@/svgs/lexical/strikethrough.svg'
import Code from '@/svgs/lexical/code-view.svg'
import Link from '@/svgs/lexical/link.svg'
import Quote from '@/svgs/lexical/quote-text.svg'
import More from '@/svgs/lexical/font-size.svg'
import styles from '../../theme.module.css'
import Dropdown from 'react-bootstrap/Dropdown'
import { useState, useEffect } from 'react'
import classNames from 'classnames'

function TextOptionsDropdown ({ editor }) {
  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle id='dropdown-basic' as='a' onPointerDown={e => e.preventDefault()}>
        <More width={18} height={18} />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')} className={styles.dropdownExtraFormatting}>
          <span>
            <Strikethrough width={18} height={18} />
            Strikethrough
          </span>
          <span className='text-muted'>
            ⌘+Shift+X
          </span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'quote')} className={styles.dropdownExtraFormatting}>
          <span>
            <Quote width={18} height={18} />
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
  const [isBold, setIsBold] = useState(false)

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          setIsBold(selection.hasFormat('bold'))
        }
      })
    })
  }, [editor])

  return (
    <div className={styles.toolbarFormatting}>
      <span
        className={classNames(styles.formattingItem, isBold ? styles.active : '')}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
      >
        <Bold width={18} height={18} />
      </span>

      <span
        className='pointer'
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
      >
        <Italic width={18} height={18} />
      </span>

      <span
        className='pointer'
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
      >
        <Underline width={18} height={18} />
      </span>

      <span
        className='pointer'
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
      >
        <Code width={18} height={18} />
      </span>

      <span
        className='pointer'
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'link')}
      >
        <Link width={18} height={18} />
      </span>
      <TextOptionsDropdown editor={editor} />
    </div>
  )
}
