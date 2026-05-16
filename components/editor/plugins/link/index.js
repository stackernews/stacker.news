import { useCallback, useEffect, useState } from 'react'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import { $createAutoLinkNode, $isAutoLinkNode, $isLinkNode } from '@lexical/link'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  PASTE_COMMAND, SELECTION_CHANGE_COMMAND,
  $getSelection, $isNodeSelection, $isRangeSelection,
  COMMAND_PRIORITY_HIGH, COMMAND_PRIORITY_LOW
} from 'lexical'
import LinkEditor from './editor'
import { getSelectedNode } from '@/lib/lexical/commands/utils'
import { SN_TOGGLE_LINK_COMMAND } from '@/lib/lexical/commands/links'
import { ensureProtocol, removeTracking, URL_REGEXP } from '@/lib/url'
import { $isCodeNode } from '@lexical/code-core'

export default function LinkEditorPlugin ({ anchorElem }) {
  const [isLinkEditable, setIsLinkEditable] = useState(false)
  const [nodeKey, setNodeKey] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [editor] = useLexicalComposerContext()

  const handleDismiss = useCallback(() => setDismissed(true), [])

  const handleSelectionChange = useCallback((selection) => {
    let isLink = false
    let linkNodeKey = null

    // handle selection change
    if ($isRangeSelection(selection)) {
      const focusNode = getSelectedNode(selection)
      const focusLinkNode = $findMatchingParent(focusNode, $isLinkNode)
      const focusAutoLinkNode = $findMatchingParent(focusNode, $isAutoLinkNode)

      // check anchor node
      const linkNode = focusLinkNode || focusAutoLinkNode

      if (!selection.isCollapsed()) {
        const anchorNode = selection.anchor.getNode()
        const anchorLinkNode = $findMatchingParent(anchorNode, $isLinkNode)
        const anchorAutoLinkNode = $findMatchingParent(anchorNode, $isAutoLinkNode)

        // show editor if both anchor and focus are in the same link
        if (linkNode && (linkNode === anchorLinkNode || linkNode === anchorAutoLinkNode)) {
          isLink = true
          linkNodeKey = linkNode.getKey()
        }
      } else if (linkNode) {
        isLink = true
        linkNodeKey = linkNode.getKey()
      }
    // handle node selection change
    } else if ($isNodeSelection(selection)) {
      const nodes = selection.getNodes()
      if (nodes.length > 0) {
        const node = nodes[0]
        const parent = node.getParent()

        if ($isLinkNode(parent)) {
          isLink = true
          linkNodeKey = parent.getKey()
        } else if ($isLinkNode(node)) {
          isLink = true
          linkNodeKey = node.getKey()
        }
      }
    }

    if (editor.isEditable()) {
      setNodeKey(linkNodeKey)
      setIsLinkEditable(isLink)
    }
  }, [editor])

  // paste link into selection
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          setDismissed(false)
          const selection = $getSelection()
          handleSelectionChange(selection)
          return false
        }, COMMAND_PRIORITY_LOW),
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return false

          // check if we're inside a CodeNode
          const anchorNode = selection.anchor.getNode()
          const codeNode = $findMatchingParent(anchorNode, $isCodeNode)
          if (codeNode) {
            // let default paste behavior handle it (plain text)
            return false
          }

          const text = event.clipboardData?.getData('text/plain')?.trim()
          if (!text || !URL_REGEXP.test(text)) return false

          event.preventDefault()

          const href = ensureProtocol(removeTracking(text))
          if (!href) return false

          if (!selection.isCollapsed()) {
            editor.dispatchCommand(SN_TOGGLE_LINK_COMMAND, href)
            return true
          }

          const autolink = $createAutoLinkNode(href)
          selection.insertNodes([autolink])
          return true
        }, COMMAND_PRIORITY_HIGH
      ))
  }, [editor, handleSelectionChange])

  return isLinkEditable && !dismissed && <LinkEditor nodeKey={nodeKey} anchorElem={anchorElem} onDismiss={handleDismiss} />
}
