import { useCallback, useEffect, useState } from 'react'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import { $createLinkNode, $isAutoLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  COMMAND_PRIORITY_HIGH,
  KEY_ESCAPE_COMMAND,
  $getSelection, $isNodeSelection, $isRangeSelection, isCurrentlyReadOnlyMode
} from 'lexical'
import { Popover, PopoverContent } from '@/components/ui/popover'
import Check from '@/svgs/check-line.svg'
import Pencil from '@/svgs/edit-line.svg'
import { getSelectedNode } from '@/lib/lexical/commands/utils'
import { ensureProtocol } from '@/lib/url'
import styles from './linkeditor.module.css'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import CloseIcon from '@/svgs/close-line.svg'
import UnlinkIcon from '@/svgs/editor/toolbar/inline/link-unlink.svg'
import { DEFAULT_URL } from '@/lib/lexical/commands/links'

export default function LinkEditor ({ nodeKey, onDismiss }) {
  const [isLinkEditMode, setIsLinkEditMode] = useState(false)
  const [editor] = useLexicalComposerContext()
  const [linkUrl, setLinkUrl] = useState('')
  const [editedLinkUrl, setEditedLinkUrl] = useState('')

  // callback ref instead of an effect: the portaled input mounts a render after
  // isLinkEditMode flips, so an effect keyed on the flag can run before it exists
  const inputRef = useCallback((el) => {
    if (el) {
      // the popup isn't positioned yet, a plain focus() would scroll to the document origin
      el.focus({ preventScroll: true })
      el.select()
    }
  }, [])

  // must be idempotent: escape reaches here twice, from the popover and from KEY_ESCAPE_COMMAND
  const handleCancel = useCallback(() => {
    // don't toggle link if the editor is currently read-only
    // e.g. lexical reconciliation during a markdown-to-rich mode switch
    if (!isCurrentlyReadOnlyMode()) {
      if (linkUrl === '' || linkUrl === DEFAULT_URL) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      }
    }
    onDismiss()
  }, [editor, linkUrl, onDismiss])

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
      return
    }

    const newUrl = linkNode.getURL()
    setLinkUrl(newUrl)

    if (!isLinkEditMode && (newUrl.trim() === '' || newUrl.trim() === DEFAULT_URL)) {
      setEditedLinkUrl('')
      setIsLinkEditMode(true)
    }
  }, [isLinkEditMode, nodeKey])

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
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      onDismiss()
    }
    setEditedLinkUrl('')
    setIsLinkEditMode(false)
  }, [editedLinkUrl, editor, onDismiss])

  // editor updates, selection changes, escape key
  useEffect(() => {
    // registerUpdateListener only fires on later updates, so read the initial state ourselves
    editor.getEditorState().read(() => { $updateLink() })

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          $updateLink()
        })
      }),
      // with focus in the editor the popover's own escape handling fires too (see handleCancel)
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          handleCancel()
          return false
        }, COMMAND_PRIORITY_HIGH)
    )
  }, [editor, $updateLink, handleCancel])

  // mounted means open, the plugin unmounts us on dismiss
  return (
    <Popover
      open
      modal={false}
      onOpenChange={(open, details) => {
        if (open) return
        if (details.reason === 'outside-press') {
          // presses inside the editor only move the caret and may have just opened us
          const target = details.event?.target
          if (target instanceof window.Node && editor.getRootElement()?.contains(target)) return
          handleCancel()
        } else if (details.reason === 'escape-key' || details.reason === 'focus-out') {
          handleCancel()
        }
      }}
    >
      <PopoverContent
        anchor={() => editor.getElementByKey(nodeKey)}
        side='bottom' align='start' sideOffset={8} arrow={false}
        aria-label='link editor' initialFocus={false} className='p-0 max-w-none'
      >
        <div className={styles.linkEditor} data-node-key={nodeKey}>
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
                  <button type='button' aria-label='cancel' className={styles.linkCancelIcon} onMouseDown={(e) => e.preventDefault()} onClick={handleCancel}>
                    <CloseIcon />
                  </button>
                  <button type='button' aria-label='confirm' className={styles.linkConfirmIcon} onMouseDown={(e) => e.preventDefault()} onClick={handleLinkConfirm}>
                    <Check />
                  </button>
                </div>
              </>
              )
            : (
              <>
                <a
                  className={styles.linkView}
                  href={ensureProtocol(linkUrl)}
                  target='_blank'
                  rel='noreferrer nofollow noopener'
                >
                  {linkUrl}
                </a>
                <div className={styles.linkConfirmIcons}>
                  <button type='button' aria-label='edit link' className={styles.linkEditIcon} onMouseDown={(e) => e.preventDefault()} onClick={() => { setEditedLinkUrl(linkUrl); setIsLinkEditMode(true) }}>
                    <Pencil />
                  </button>
                  <button
                    type='button' aria-label='remove link' className={styles.linkRemoveIcon} onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
                      onDismiss()
                    }}
                  >
                    <UnlinkIcon />
                  </button>
                </div>
              </>
              )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
