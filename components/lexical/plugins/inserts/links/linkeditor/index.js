import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import Remove from '@/svgs/delete-bin-line.svg'
import { setFloatingElemPosition } from './position'
import { getSelectedNode } from '@/components/lexical/utils/selection'
import { ensureProtocol } from '@/lib/url'
import styles from './linkeditor.module.css'

export default function LinkEditor ({ nodeKey, anchorElem }) {
  const [isLinkEditMode, setIsLinkEditMode] = useState(false)
  const [editor] = useLexicalComposerContext()
  const floatingRef = useRef(null)
  const inputRef = useRef(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [editedLinkUrl, setEditedLinkUrl] = useState('')

  const inputInteraction = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      $linkConfirm()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      $handleCancel()
    }
  }

  const $handleCancel = () => {
    setFloatingElemPosition({ targetRect: null, floatingElem: floatingRef.current, anchorElem, fade: false })
    setIsLinkEditMode(false)
    if (linkUrl === '') {
      editor.update(() => {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      })
    }
  }

  useEffect(() => {
    if (isLinkEditMode) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isLinkEditMode])

  const $updateLink = useCallback(() => {
    const selection = $getSelection()
    let newUrl = ''
    let linkNodeKey = null

    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection)
      const linkParent = $findMatchingParent(node, $isLinkNode)

      if (linkParent) {
        newUrl = linkParent.getURL()
        linkNodeKey = linkParent.getKey()
      } else if ($isLinkNode(node)) {
        newUrl = node.getURL()
        linkNodeKey = node.getKey()
      }
    } else if ($isNodeSelection(selection)) {
      const nodes = selection.getNodes()
      if (nodes.length > 0) {
        const node = nodes[0]
        const parent = node.getParent()
        if ($isLinkNode(parent)) {
          newUrl = parent.getURL()
          linkNodeKey = parent.getKey()
        } else if ($isLinkNode(node)) {
          newUrl = node.getURL()
          linkNodeKey = node.getKey()
        }
      }
    }

    // bail if the passed nodeKey is not the same as the link node key anymore
    if (!linkNodeKey || linkNodeKey !== nodeKey) {
      setLinkUrl('')
      setEditedLinkUrl('')
      if (isLinkEditMode) setIsLinkEditMode(false)

      const floatingElem = floatingRef.current
      if (floatingElem && anchorElem) {
        setFloatingElemPosition({ targetRect: null, floatingElem, anchorElem, fade: false })
      }
      return
    }

    setLinkUrl(newUrl)

    if (isLinkEditMode) {
      setEditedLinkUrl(newUrl || '')
    } else if ((newUrl || '').trim() === '') {
      setEditedLinkUrl('')
      setIsLinkEditMode(true)
    }

    const floatingElem = floatingRef.current
    if (!floatingElem || !anchorElem) return
    if (!nodeKey) {
      setFloatingElemPosition({ targetRect: null, floatingElem, anchorElem, fade: false })
      return
    }
    const el = editor.getElementByKey(nodeKey)
    if (!el) {
      setFloatingElemPosition({ targetRect: null, floatingElem, anchorElem, fade: false })
      return
    }
    const pos = el.getBoundingClientRect()
    pos.y += 26
    setFloatingElemPosition({ targetRect: pos, floatingElem, anchorElem, verticalGap: 8, horizontalOffset: 0, fade: false })
  }, [anchorElem, editor, setIsLinkEditMode, isLinkEditMode, linkUrl, nodeKey])

  const handleBlur = useCallback((event) => {
    const floatingElem = floatingRef.current
    if (!floatingElem) return

    if (!event || !floatingElem.contains(event.relatedTarget)) {
      // if there is no change, or the edited link url is empty, exit edit mode
      if (editedLinkUrl === linkUrl || editedLinkUrl === '') {
        $handleCancel()
      }
    }
  }, [editedLinkUrl, anchorElem, floatingRef, editor, linkUrl])

  const $linkConfirm = () => {
    const value = editedLinkUrl.trim()
    if (value !== '') {
      editor.update(() => {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, ensureProtocol(value))
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const parent = getSelectedNode(selection).getParent()
          if ($isAutoLinkNode(parent)) {
            const linkNode = $createLinkNode(parent.getURL(), {
              rel: parent.__rel,
              target: parent.__target,
              title: parent.__title
            })
            parent.replace(linkNode, true)
          }
        }
      })
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
    }
    setEditedLinkUrl('')
    setIsLinkEditMode(false)
  }

  // update link editor on lexical updates
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
          return true
        }, COMMAND_PRIORITY_LOW),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          handleBlur()
          return true
        }, COMMAND_PRIORITY_HIGH)
    )
  }, [editor, nodeKey, $updateLink])

  useLayoutEffect(() => {
    editor.getEditorState().read(() => {
      $updateLink()
    })
  }, [editor, $updateLink])

  // update position
  useEffect(() => {
    const scrollerElem = anchorElem?.parentElement

    const update = () => {
      editor.getEditorState().read(() => {
        $updateLink()
      })
    }

    window.addEventListener('resize', update)
    scrollerElem?.addEventListener('scroll', update)
    update()

    return () => {
      window.removeEventListener('resize', update)
      scrollerElem?.removeEventListener('scroll', update)
    }
  }, [editor, nodeKey, anchorElem])

  // blur from input or anchor element
  useEffect(() => {
    const editorElem = floatingRef.current
    if (!editorElem) return

    editorElem.addEventListener('focusout', handleBlur)
    anchorElem.addEventListener('focusout', handleBlur)
    return () => {
      editorElem.removeEventListener('focusout', handleBlur)
      anchorElem.removeEventListener('focusout', handleBlur)
    }
  }, [editor, nodeKey, anchorElem, handleBlur])

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
                onKeyDown={(e) => inputInteraction(e)}
              />
              <div className={styles.linkConfirmIcons}>
                <span className={styles.linkCancelIcon} onMouseDown={(e) => e.preventDefault()} onClick={$handleCancel}>
                  X
                </span>
                <span className={styles.linkConfirmIcon} onMouseDown={(e) => e.preventDefault()} onClick={$linkConfirm}>
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
                <span className={styles.linkEditIcon} onMouseDown={(e) => e.preventDefault()} onClick={() => { setEditedLinkUrl(linkUrl || ''); setIsLinkEditMode(true) }}>
                  <Pencil />
                </span>
                <span className={styles.linkRemoveIcon} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)}>
                  <Remove />
                </span>
              </div>
            </>
            )}
      </div>
    </div>,
    anchorElem
  )
}
