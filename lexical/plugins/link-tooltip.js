import { $isAutoLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import styles from '../styles.module.css'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ESCAPE_COMMAND,
  SELECTION_CHANGE_COMMAND
} from 'lexical'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as React from 'react'

import { getSelectedNode } from '../utils/selected-node'
import { setTooltipPosition } from '../utils/tooltip-position'
import { useLinkInsert } from './link-insert'
import { getLinkFromSelection } from '../utils/link-from-selection'

function FloatingLinkEditor ({
  editor,
  isLink,
  setIsLink,
  anchorElem
}) {
  const { setLink } = useLinkInsert()
  const editorRef = useRef(null)
  const inputRef = useRef(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [isEditMode, setEditMode] = useState(false)

  const updateLinkEditor = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection)
      const parent = node.getParent()
      if ($isLinkNode(parent)) {
        setLinkUrl(parent.getURL())
      } else if ($isLinkNode(node)) {
        setLinkUrl(node.getURL())
      } else {
        setLinkUrl('')
      }
    }
    const editorElem = editorRef.current
    const nativeSelection = window.getSelection()
    const activeElement = document.activeElement

    if (editorElem === null) {
      return
    }

    const rootElement = editor.getRootElement()

    if (
      selection !== null &&
       nativeSelection !== null &&
       rootElement !== null &&
       rootElement.contains(nativeSelection.anchorNode) &&
       editor.isEditable()
    ) {
      const domRange = nativeSelection.getRangeAt(0)
      let rect
      if (nativeSelection.anchorNode === rootElement) {
        let inner = rootElement
        while (inner.firstElementChild != null) {
          inner = inner.firstElementChild
        }
        rect = inner.getBoundingClientRect()
      } else {
        rect = domRange.getBoundingClientRect()
      }

      setTooltipPosition(rect, editorElem, anchorElem)
    } else if (!activeElement) {
      if (rootElement !== null) {
        setTooltipPosition(null, editorElem, anchorElem)
      }
      setEditMode(false)
      setLinkUrl('')
    }

    return true
  }, [anchorElem, editor])

  useEffect(() => {
    const scrollerElem = anchorElem.parentElement

    const update = () => {
      editor.getEditorState().read(() => {
        updateLinkEditor()
      })
    }

    window.addEventListener('resize', update)

    if (scrollerElem) {
      scrollerElem.addEventListener('scroll', update)
    }

    return () => {
      window.removeEventListener('resize', update)

      if (scrollerElem) {
        scrollerElem.removeEventListener('scroll', update)
      }
    }
  }, [anchorElem.parentElement, editor, updateLinkEditor])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateLinkEditor()
        })
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateLinkEditor()
          return true
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (isLink) {
            setIsLink(false)
            return true
          }
          return false
        },
        COMMAND_PRIORITY_HIGH
      )
    )
  }, [editor, updateLinkEditor, setIsLink, isLink])

  useEffect(() => {
    editor.getEditorState().read(() => {
      updateLinkEditor()
    })
  }, [editor, updateLinkEditor])

  useEffect(() => {
    if (isEditMode && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditMode])

  return (
    linkUrl &&
      <div ref={editorRef} className={styles.linkTooltip}>
        <div className='tooltip-inner d-flex'>
          <a href={linkUrl} target='_blank' rel='noreferrer' className={`${styles.tooltipUrl} text-reset`}>{linkUrl.replace('https://', '').replace('http://', '')}</a>
          <span className='px-1'> \ </span>
          <span
            className='pointer'
            onClick={() => {
              editor.update(() => {
                // we need to replace the link
                // their playground simple 'TOGGLE's it with a new url
                // but we need to potentiallyr replace the text
                setLink(getLinkFromSelection())
              })
            }}
          >edit
          </span>
          <span className='px-1'> \ </span>
          <span
            className='pointer'
            onClick={() => {
              editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
            }}
          >remove
          </span>
        </div>
      </div>
  )
}

function useFloatingLinkEditorToolbar ({ editor, anchorElem }) {
  const [activeEditor, setActiveEditor] = useState(editor)
  const [isLink, setIsLink] = useState(false)

  const updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection)
      const linkParent = $findMatchingParent(node, $isLinkNode)
      const autoLinkParent = $findMatchingParent(node, $isAutoLinkNode)

      // We don't want this menu to open for auto links.
      if (linkParent != null && autoLinkParent == null) {
        setIsLink(true)
      } else {
        setIsLink(false)
      }
    }
  }, [])

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      (_payload, newEditor) => {
        updateToolbar()
        setActiveEditor(newEditor)
        return false
      },
      COMMAND_PRIORITY_CRITICAL
    )
  }, [editor, updateToolbar])

  return isLink
    ? <FloatingLinkEditor
        editor={activeEditor}
        isLink={isLink}
        anchorElem={anchorElem}
        setIsLink={setIsLink}
      />
    : null
}

export default function LinkTooltipPlugin ({
  anchorElem = document.body
}) {
  const [editor] = useLexicalComposerContext()
  return useFloatingLinkEditorToolbar({ editor, anchorElem })
}
