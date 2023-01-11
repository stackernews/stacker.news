import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SELECTION_CHANGE_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode
} from 'lexical'
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import {
  $wrapNodes
} from '@lexical/selection'
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils'
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode
} from '@lexical/list'
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode
} from '@lexical/rich-text'
// import {
//   $createCodeNode
// } from '@lexical/code'
import BoldIcon from '../../svgs/bold.svg'
import ItalicIcon from '../../svgs/italic.svg'
// import StrikethroughIcon from '../../svgs/strikethrough.svg'
import LinkIcon from '../../svgs/link.svg'
import ListOrderedIcon from '../../svgs/list-ordered.svg'
import ListUnorderedIcon from '../../svgs/list-unordered.svg'
import IndentIcon from '../../svgs/indent-increase.svg'
import OutdentIcon from '../../svgs/indent-decrease.svg'
import ImageIcon from '../../svgs/image-line.svg'
import FontSizeIcon from '../../svgs/font-size-2.svg'
import QuoteIcon from '../../svgs/double-quotes-r.svg'
// import CodeIcon from '../../svgs/code-line.svg'
// import CodeBoxIcon from '../../svgs/code-box-line.svg'
import ArrowDownIcon from '../../svgs/arrow-down-s-fill.svg'
import CheckIcon from '../../svgs/check-line.svg'

import styles from '../styles.module.css'
import { Dropdown } from 'react-bootstrap'
import { useLinkInsert } from './link-insert'
import { getSelectedNode } from '../utils/selected-node'
import { getLinkFromSelection } from '../utils/link-from-selection'
import { ImageInsertModal } from './image-insert'
import useModal from '../utils/modal'

const LowPriority = 1

function Divider () {
  return <div className={styles.divider} />
}

function FontSizeDropdown ({
  editor,
  blockType
}) {
  const formatParagraph = () => {
    if (blockType !== 'paragraph') {
      editor.update(() => {
        const selection = $getSelection()

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createParagraphNode())
        }
        setTimeout(() => editor.focus(), 100)
      })
    }
  }

  const formatLargeHeading = () => {
    if (blockType !== 'h1') {
      editor.update(() => {
        const selection = $getSelection()

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createHeadingNode('h1'))
        }

        setTimeout(() => editor.focus(), 100)
      })
    }
  }

  const formatSmallHeading = () => {
    if (blockType !== 'h2') {
      editor.update(() => {
        const selection = $getSelection()

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createHeadingNode('h2'))
        }

        setTimeout(() => editor.focus(), 100)
      })
    }
  }

  return (
    <Dropdown className='pointer' as='span'>
      <Dropdown.Toggle
        id='dropdown-basic'
        as='button' className={styles.toolbarItem} aria-label='Font size'
      >
        <FontSizeIcon />
        <ArrowDownIcon />
      </Dropdown.Toggle>

      <Dropdown.Menu>
        <Dropdown.Item as='button' className={`${styles.paragraph} my-0`} onClick={formatParagraph}>
          <CheckIcon className={`mr-1 ${blockType === 'paragraph' ? 'fill-grey' : 'invisible'}`} />
          <span className={styles.text}>normal</span>
        </Dropdown.Item>
        <Dropdown.Item as='button' className={`${styles.heading2} my-0`} onClick={formatSmallHeading}>
          <CheckIcon className={`mr-1 ${['h2', 'h3', 'h4', 'h5', 'h6'].includes(blockType) ? 'fill-grey' : 'invisible'}`} />
          <span className={styles.text}>subheading</span>
        </Dropdown.Item>
        <Dropdown.Item as='button' className={`${styles.heading1} my-0`} onClick={formatLargeHeading}>
          <CheckIcon className={`mr-1 ${blockType === 'h1' ? 'fill-grey' : 'invisible'}`} />
          <span className={styles.text}>heading</span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}

export default function ToolbarPlugin () {
  const [editor] = useLexicalComposerContext()
  const { setLink } = useLinkInsert()
  const toolbarRef = useRef(null)
  const [blockType, setBlockType] = useState('paragraph')
  const [isLink, setIsLink] = useState(false)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  // const [isStrikethrough, setIsStrikethrough] = useState(false)
  // const [isCode, setIsCode] = useState(false)
  const [modal, showModal] = useModal()

  const updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode()
      const element =
        anchorNode.getKey() === 'root'
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow()
      const elementKey = element.getKey()
      const elementDOM = editor.getElementByKey(elementKey)
      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode)
          const type = parentList ? parentList.getTag() : element.getTag()
          setBlockType(type)
        } else {
          const type = $isHeadingNode(element)
            ? element.getTag()
            : element.getType()
          setBlockType(type)
        }
      }
      // Update text format
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      // setIsStrikethrough(selection.hasFormat('strikethrough'))
      // setIsCode(selection.hasFormat('code'))

      // Update links
      const node = getSelectedNode(selection)
      const parent = node.getParent()
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        setIsLink(true)
      } else {
        setIsLink(false)
      }
    }
  }, [editor])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar()
        })
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, newEditor) => {
          updateToolbar()
          return false
        },
        LowPriority
      )
    )
  }, [editor, updateToolbar])

  const insertLink = useCallback(() => {
    if (isLink) {
      // unlink it
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
    } else {
      editor.update(() => {
        setLink(getLinkFromSelection())
      })
    }
  }, [editor, isLink])

  const formatBulletList = () => {
    if (blockType !== 'ul') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND)
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND)
    }
  }

  const formatNumberedList = () => {
    if (blockType !== 'ol') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND)
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND)
    }
  }

  const formatQuote = () => {
    if (blockType !== 'quote') {
      editor.update(() => {
        const selection = $getSelection()

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createQuoteNode())
        }
      })
    } else {
      editor.update(() => {
        const selection = $getSelection()

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createParagraphNode())
        }
      })
    }
  }

  // const formatCode = () => {
  //   if (blockType !== 'code') {
  //     editor.update(() => {
  //       const selection = $getSelection()

  //       if ($isRangeSelection(selection)) {
  //         $wrapNodes(selection, () => {
  //           const node = $createCodeNode()
  //           node.setLanguage('plain')
  //           return node
  //         })
  //       }
  //     })
  //   }
  // }

  return (
    <div className={styles.toolbar} ref={toolbarRef}>
      <FontSizeDropdown editor={editor} blockType={blockType} />
      <Divider />
      <>
        <button
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')
          }}
          className={`${styles.toolbarItem} ${styles.spaced} ${isBold ? styles.active : ''}`}
          aria-label='Format Bold'
        >
          <BoldIcon />
        </button>
        <button
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')
          }}
          className={`${styles.toolbarItem} ${styles.spaced} ${isItalic ? styles.active : ''}`}
          aria-label='Format Italics'
        >
          <ItalicIcon />
        </button>
        <Divider />
        <button
          onClick={formatBulletList}
          className={`${styles.toolbarItem} ${styles.spaced} ${blockType === 'ul' ? styles.active : ''}`}
        >
          <ListUnorderedIcon />
        </button>
        <button
          onClick={formatNumberedList}
          className={`${styles.toolbarItem} ${styles.spaced} ${blockType === 'ol' ? styles.active : ''}`}
          aria-label='Insert numbered list'
        >
          <ListOrderedIcon />
        </button>
        <button
          onClick={() => {
            editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)
          }}
          className={`${styles.toolbarItem} ${styles.spaced}`}
          aria-label='Indent'
        >
          <IndentIcon />
        </button>
        <button
          onClick={() => {
            editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)
          }}
          className={`${styles.toolbarItem} ${styles.spaced}`}
          aria-label='Outdent'
        >
          <OutdentIcon />
        </button>
        <button
          onClick={formatQuote}
          className={`${styles.toolbarItem} ${styles.spaced} ${blockType === 'quote' ? styles.active : ''}`}
          aria-label='Insert Quote'
        >
          <QuoteIcon />
        </button>
        {/* <Divider /> */}
        {/* <button
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
          }}
          className={
            `${styles.toolbarItem} ${styles.spaced} ${isStrikethrough ? styles.active : ''}`
            }
          aria-label='Format Strikethrough'
        >
          <StrikethroughIcon />
        </button> */}
        {/* <button
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')
          }}
          className={`${styles.toolbarItem} ${styles.spaced} ${isCode ? styles.active : ''}`}
          aria-label='Insert Code'
        >
          <CodeIcon />
        </button> */}
        {/* <button
          onClick={formatCode}
          className={`${styles.toolbarItem} ${styles.spaced} ${blockType === 'code' ? styles.active : ''}`}
          aria-label='Insert Code'
        >
          <CodeBoxIcon />
        </button> */}
        <Divider />
        <button
          onClick={insertLink}
          className={`${styles.toolbarItem} ${styles.spaced} ${isLink ? styles.active : ''}`}
          aria-label='Insert Link'
        >
          <LinkIcon />
        </button>
        <button
          onClick={() => {
            showModal((onClose) => (
              <ImageInsertModal
                editor={editor}
                onClose={onClose}
              />
            ))
          }}
          className={`${styles.toolbarItem} ${styles.spaced}`}
          aria-label='Insert Image'
        >
          <ImageIcon />
        </button>
        {modal}
      </>
    </div>
  )
}
