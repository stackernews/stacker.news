import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import { $createLinkNode, $isAutoLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  COMMAND_PRIORITY_HIGH, COMMAND_PRIORITY_LOW,
  KEY_ESCAPE_COMMAND, SELECTION_CHANGE_COMMAND,
  $getSelection, $isNodeSelection, $isRangeSelection
} from 'lexical'
import Check from '@/svgs/check-line.svg'
import Pencil from '@/svgs/edit-line.svg'
import { setFloatingElemPosition } from '@/lib/lexical/utils/position'
import { getSelectedNode } from '@/lib/lexical/commands/utils'
import { ensureProtocol } from '@/lib/url'
import styles from './linkeditor.module.css'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import CloseIcon from '@/svgs/close-line.svg'
import UnlinkIcon from '@/svgs/editor/toolbar/inline/link-unlink.svg'
import { DEFAULT_URL } from '@/lib/lexical/commands/links'

/** how distant the link editor should appear from the link element */
const LINK_ELEMENT_VERTICAL_OFFSET = 26

export default function LinkEditor ({ nodeKey, anchorElem, onDismiss }) {
  const [isLinkEditMode, setIsLinkEditMode] = useState(false)
  const [editor] = useLexicalComposerContext()
  const floatingRef = useRef(null)
  const inputRef = useRef(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [editedLinkUrl, setEditedLinkUrl] = useState('')

  const hideFloatingElem = useCallback(() => {
    if (!floatingRef.current) return
    setFloatingElemPosition({ targetRect: null, floatingElem: floatingRef.current, anchorElem, fade: false })
    onDismiss()
  }, [anchorElem, onDismiss])

  const handleCancel = useCallback(() => {
    hideFloatingElem()
    if (linkUrl === '' || linkUrl === DEFAULT_URL) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
    }
  }, [hideFloatingElem, editor, linkUrl])

  useEffect(() => {
    if (isLinkEditMode) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isLinkEditMode])

  const $updateLink = useCallback(() => {
    const selection = $getSelection()

    let linkNode = null
    if ($isRangeSelection(selection)) {
      linkNode = $findMatchingParent(getSelectedNode(selection), $isLinkNode)
    } else if ($isNodeSelection(selection)) {
      const node = selection.getNodes()[0]
      if (node) linkNode = $findMatchingParent(node, $isLinkNode)
    }

    if (!linkNode || linkNode.getKey() !== nodeKey) {
      setLinkUrl('')
      setEditedLinkUrl('')
      if (isLinkEditMode) setIsLinkEditMode(false)
      hideFloatingElem()
      return
    }

    const newUrl = linkNode.getURL()
    setLinkUrl(newUrl)

    if (!isLinkEditMode && (newUrl.trim() === '' || newUrl === DEFAULT_URL)) {
      setEditedLinkUrl('')
      setIsLinkEditMode(true)
    }

    const floatingElem = floatingRef.current
    if (!floatingElem || !anchorElem) return

    const el = editor.getElementByKey(nodeKey)
    if (!el) {
      hideFloatingElem()
      return
    }
    const pos = el.getBoundingClientRect()
    pos.y += LINK_ELEMENT_VERTICAL_OFFSET
    setFloatingElemPosition({ targetRect: pos, floatingElem, anchorElem, verticalGap: 8, horizontalOffset: 0, fade: false })
  }, [anchorElem, editor, isLinkEditMode, nodeKey, hideFloatingElem])

  const handleLinkConfirm = useCallback(() => {
    const value = editedLinkUrl.trim()
    if (value !== '') {
      editor.update(() => {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, ensureProtocol(value))
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const parent = getSelectedNode(selection).getParent()
          // replace auto link node with link node
          if ($isAutoLinkNode(parent)) {
            const linkNode = $createLinkNode(parent.getURL(), { target: '_blank', rel: UNKNOWN_LINK_REL })
            parent.replace(linkNode, true)
          }
        }
      })
    } else {
      hideFloatingElem()
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
    }
    setEditedLinkUrl('')
    setIsLinkEditMode(false)
  }, [editedLinkUrl, editor, hideFloatingElem])

  const handleBlur = useCallback((event) => {
    const floatingElem = floatingRef.current
    if (!floatingElem) return

    if (!event || !floatingElem.contains(event.relatedTarget)) {
      if (editedLinkUrl !== '' && editedLinkUrl !== linkUrl) {
        handleLinkConfirm()
      } else {
        handleCancel()
      }
    }
  }, [editedLinkUrl, linkUrl, handleCancel, handleLinkConfirm])

  // editor updates, selection changes, escape key
  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          $updateLink()
        })
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          $updateLink()
          return false
        }, COMMAND_PRIORITY_LOW),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          handleCancel()
          return false
        }, COMMAND_PRIORITY_HIGH)
    )
  }, [editor, $updateLink, handleCancel])

  // throttled update of position
  useEffect(() => {
    const scrollerElem = anchorElem?.parentElement
    let rafId = null

    const update = () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        editor.getEditorState().read(() => {
          $updateLink()
        })
      })
    }

    // synchronous initial read so the position is correct on the same frame
    editor.getEditorState().read(() => { $updateLink() })

    window.addEventListener('resize', update)
    scrollerElem?.addEventListener('scroll', update)

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', update)
      scrollerElem?.removeEventListener('scroll', update)
    }
  }, [editor, anchorElem, $updateLink])

  // blur from input or anchor element
  useEffect(() => {
    const editorElem = floatingRef.current
    if (!editorElem || !anchorElem) return

    editorElem.addEventListener('focusout', handleBlur)
    anchorElem.addEventListener('focusout', handleBlur)
    return () => {
      editorElem.removeEventListener('focusout', handleBlur)
      anchorElem.removeEventListener('focusout', handleBlur)
    }
  }, [anchorElem, handleBlur])

  if (!anchorElem) return null

  return createPortal(
    <div className={styles.linkEditorContainer} ref={floatingRef} data-node-key={nodeKey}>
      <div className={styles.linkEditor}>
        {isLinkEditMode
          ? (
            <>
              <input
                ref={inputRef}
                className={styles.linkInput}
                value={editedLinkUrl}
                placeholder='https://'
                onChange={(e) => { setEditedLinkUrl(e.target.value) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleLinkConfirm()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    handleCancel()
                  }
                }}
              />
              <div className={styles.linkConfirmIcons}>
                <span className={styles.linkCancelIcon} onMouseDown={(e) => e.preventDefault()} onClick={handleCancel}>
                  <CloseIcon />
                </span>
                <span className={styles.linkConfirmIcon} onMouseDown={(e) => e.preventDefault()} onClick={handleLinkConfirm}>
                  <Check />
                </span>
              </div>
            </>
            )
          : (
            <>
              <Link
                className={styles.linkView}
                href={ensureProtocol(linkUrl)}
                target='_blank'
                rel='noreferrer nofollow noopener'
              >
                {linkUrl}
              </Link>
              <div className={styles.linkConfirmIcons}>
                <span className={styles.linkEditIcon} onMouseDown={(e) => e.preventDefault()} onClick={() => { setEditedLinkUrl(linkUrl); setIsLinkEditMode(true) }}>
                  <Pencil />
                </span>
                <span className={styles.linkRemoveIcon} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)}>
                  <UnlinkIcon />
                </span>
              </div>
            </>
            )}
      </div>
    </div>,
    anchorElem
  )
}
