import { useCallback, useEffect, useState } from 'react'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import { $createLinkNode, $isAutoLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  COMMAND_PRIORITY_HIGH,
  KEY_ESCAPE_COMMAND,
  $getSelection, $isNodeSelection, $isRangeSelection, isCurrentlyReadOnlyMode
} from 'lexical'
import { Popover as BasePopover } from '@base-ui/react/popover'
import { popoverClasses } from '@/components/ui/popover'
import popoverStyles from '@/components/ui/popover.module.css'
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

  // the deliberate edit-mode focus steal, as a callback ref: the popup renders
  // through a portal whose container appears a render after isLinkEditMode
  // flips, so an effect keyed on the flag can run while the input doesn't
  // exist yet and never re-fire; the ref fires on the mount itself. The input
  // only renders in edit mode, so mounting means stealing
  const inputRef = useCallback((el) => {
    if (el) {
      // preventScroll: the ref fires at DOM insertion, before floating-ui
      // positions the popup, and a plain focus() scroll-into-views the popup
      // while it still sits at the document origin (page jumps to top)
      el.focus({ preventScroll: true })
      el.select()
    }
  }, [])

  // must stay idempotent: the popover's document-level Escape and Lexical's
  // KEY_ESCAPE_COMMAND both funnel here on one keypress (a second
  // TOGGLE_LINK_COMMAND null on a linkless selection is a Lexical no-op,
  // onDismiss twice is a state no-op)
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
    // initial read: the editor state that mounted us already holds the link,
    // and registerUpdateListener only fires on later updates
    editor.getEditorState().read(() => { $updateLink() })

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          $updateLink()
        })
      }),
      // kept alongside the popover's own Escape handling on purpose: Base UI's
      // dismissal listens document-level, so with focus in the editor both this
      // command and the popover's escape-key close fire on one keypress; that
      // double-fire is safe only while handleCancel stays idempotent (above)
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          handleCancel()
          return false
        }, COMMAND_PRIORITY_HIGH)
    )
  }, [editor, $updateLink, handleCancel])

  // open is always true while mounted: the plugin's isLinkEditable && !dismissed
  // control above is the open state; position tracks the live link element by
  // nodeKey (the function anchor re-resolves per update, floating-ui autoUpdate
  // covers ancestor scroll and resize natively)
  return (
    <BasePopover.Root
      open
      modal={false}
      onOpenChange={(open, details) => {
        if (open) return
        if (details.reason === 'outside-press') {
          // Presses inside the editor only move the caret. A link press can
          // open this popup on pointerdown, so its release must not immediately
          // dismiss the same popup.
          const target = details.event?.target
          if (target instanceof window.Node && editor.getRootElement()?.contains(target)) return
          handleCancel()
        } else if (details.reason === 'escape-key' || details.reason === 'focus-out') {
          handleCancel()
        }
      }}
    >
      <BasePopover.Portal>
        <BasePopover.Positioner
          anchor={() => editor.getElementByKey(nodeKey)}
          side='bottom' align='start' sideOffset={8}
          className={popoverStyles.positioner}
        >
          <BasePopover.Popup aria-label='Link editor' initialFocus={false} className={popoverClasses({ className: 'p-0 max-w-none' })}>
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
                      <button type='button' aria-label='Cancel' className={styles.linkCancelIcon} onMouseDown={(e) => e.preventDefault()} onClick={handleCancel}>
                        <CloseIcon />
                      </button>
                      <button type='button' aria-label='Confirm' className={styles.linkConfirmIcon} onMouseDown={(e) => e.preventDefault()} onClick={handleLinkConfirm}>
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
                      <button type='button' aria-label='Edit link' className={styles.linkEditIcon} onMouseDown={(e) => e.preventDefault()} onClick={() => { setEditedLinkUrl(linkUrl); setIsLinkEditMode(true) }}>
                        <Pencil />
                      </button>
                      <button type='button' aria-label='Remove link' className={styles.linkRemoveIcon} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)}>
                        <UnlinkIcon />
                      </button>
                    </div>
                  </>
                  )}
            </div>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  )
}
