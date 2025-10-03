import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './linkeditor.module.css'
import { setFloatingElemPositionForLinkEditor } from '@/components/lexical/utils/floating-link-editor-position'
import Link from 'next/link'
import { ensureProtocol } from '@/lib/url'
import Check from '@/svgs/check-line.svg'
import Pencil from '@/svgs/edit-line.svg'
import Remove from '@/svgs/delete-bin-line.svg'
import { $isAutoLinkNode, $createLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $isRangeSelection, $getSelection, $isNodeSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW, KEY_ESCAPE_COMMAND, COMMAND_PRIORITY_HIGH } from 'lexical'
import { getSelectedNode } from '@/components/lexical/utils/selection'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'

export default function LinkEditor ({ isLinkEditable, nodeKey, anchorElem }) {
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
    setFloatingElemPositionForLinkEditor(null, floatingRef.current, anchorElem)
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

    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection)
      const linkParent = $findMatchingParent(node, $isLinkNode)

      if (linkParent) {
        newUrl = linkParent.getURL()
      } else if ($isLinkNode(node)) {
        newUrl = node.getURL()
      }
    } else if ($isNodeSelection(selection)) {
      const nodes = selection.getNodes()
      if (nodes.length > 0) {
        const node = nodes[0]
        const parent = node.getParent()
        if ($isLinkNode(parent)) {
          newUrl = parent.getURL()
        } else if ($isLinkNode(node)) {
          newUrl = node.getURL()
        }
      }
    }

    setLinkUrl(newUrl)

    if (isLinkEditMode) {
      setEditedLinkUrl(newUrl || '')
    } else if (isLinkEditable && (newUrl || '').trim() === '') {
      setEditedLinkUrl('')
      setIsLinkEditMode(true)
    }

    const floatingElem = floatingRef.current
    if (!floatingElem || !anchorElem) return
    editor.getEditorState().read(() => {
      if (!isLinkEditable || !nodeKey) {
        setFloatingElemPositionForLinkEditor(null, floatingElem, anchorElem)
        return
      }
      const el = editor.getElementByKey(nodeKey)
      if (!el) {
        setFloatingElemPositionForLinkEditor(null, floatingElem, anchorElem)
        return
      }
      const pos = el.getBoundingClientRect()
      pos.y += 26
      setFloatingElemPositionForLinkEditor(pos, floatingElem, anchorElem, 8, 0)
    })
  }, [anchorElem, editor, setIsLinkEditMode, isLinkEditMode, linkUrl])

  const handleBlur = useCallback((event) => {
    const floatingElem = floatingRef.current
    if (!floatingElem || !isLinkEditable) return

    if (!event || !floatingElem.contains(event.relatedTarget)) {
      // if there is no change, or the edited link url is empty, exit edit mode
      if (editedLinkUrl === linkUrl || editedLinkUrl === '') {
        $handleCancel()
      }
    }
  }, [editedLinkUrl, isLinkEditable, anchorElem, floatingRef, editor, linkUrl])

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
  }, [editor, isLinkEditable, nodeKey, $updateLink])

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
  }, [editor, isLinkEditable, nodeKey, anchorElem])

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
  }, [editor, isLinkEditable, nodeKey, anchorElem, handleBlur])

  if (!anchorElem) return null

  return createPortal(
    <div className={styles.linkEditorContainer} ref={floatingRef}>
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
