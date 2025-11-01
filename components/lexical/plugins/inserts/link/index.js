import { useCallback, useEffect, useState } from 'react'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import { $isAutoLinkNode, $isLinkNode } from '@lexical/link'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  COMMAND_PRIORITY_LOW, PASTE_COMMAND,
  $getSelection, $isNodeSelection, $isRangeSelection
} from 'lexical'
import LinkEditor from './editor'
import { useToolbarState } from '@/components/lexical/contexts/toolbar'
import { getSelectedNode } from '@/components/lexical/universal/utils'
import { SN_TOGGLE_LINK_COMMAND } from '@/components/lexical/universal/commands/links'
import { ensureProtocol, removeTracking, URL_REGEXP } from '@/lib/url'

export default function LinkEditorPlugin ({ anchorElem }) {
  const [isLinkEditable, setIsLinkEditable] = useState(false)
  const [nodeKey, setNodeKey] = useState(null)
  const [editor] = useLexicalComposerContext()
  const { updateToolbarState } = useToolbarState()

  const handleSelectionChange = useCallback((selection) => {
    let isLink = false
    let linkNodeKey = null

    // handle selection change
    if ($isRangeSelection(selection)) {
      const focusNode = getSelectedNode(selection)
      const focusLinkNode = $findMatchingParent(focusNode, $isLinkNode)
      const focusAutoLinkNode = $findMatchingParent(focusNode, $isAutoLinkNode)
      const linkNode = focusLinkNode || focusAutoLinkNode

      if (linkNode) {
        isLink = true
        linkNodeKey = linkNode.getKey()
      }
    // handle node selection change
    } else if ($isNodeSelection(selection)) {
      const nodes = selection.getNodes()
      if (nodes.length > 0) {
        const node = nodes[0]
        const parent = node.getParent()

        if ($isLinkNode(parent) || $isLinkNode(node)) {
          isLink = true
          linkNodeKey = node.getKey()
        }
      }
    }

    // update toolbar state
    updateToolbarState('isLink', isLink)
    if (editor.isEditable()) {
      setNodeKey(linkNodeKey)
      setIsLinkEditable(isLink)
    }
  }, [editor, updateToolbarState])

  // paste link into selection
  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection()
          handleSelectionChange(selection)
        })
      }),
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection) || selection.isCollapsed()) return false

          const text = event.clipboardData?.getData('text/plain')?.trim()
          if (!text || !URL_REGEXP.test(text)) return false

          event.preventDefault()

          const href = ensureProtocol(removeTracking(text))
          if (!href) return false

          editor.dispatchCommand(SN_TOGGLE_LINK_COMMAND, href)
          return true
        }, COMMAND_PRIORITY_LOW
      ))
  }, [editor, nodeKey, anchorElem, handleSelectionChange])

  return isLinkEditable && <LinkEditor nodeKey={nodeKey} anchorElem={anchorElem} />
}
