import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useState } from 'react'
import { $isLinkNode, $isAutoLinkNode } from '@lexical/link'
import { SN_TOGGLE_LINK_COMMAND } from '@/components/lexical/commands/custom'
import { useToolbarState } from '@/components/lexical/contexts/toolbar'
import { PASTE_COMMAND, COMMAND_PRIORITY_LOW, $getSelection, $isRangeSelection, $isNodeSelection } from 'lexical'
import { getSelectedNode } from '@/components/lexical/utils/selection'
import { $findMatchingParent } from '@lexical/utils'
import LinkEditor from './linkeditor'
import { URL_REGEXP, ensureProtocol, removeTracking } from '@/lib/url'

export default function LinkTransformationPlugin ({ anchorElem }) {
  const [isLinkEditable, setIsLinkEditable] = useState(false)
  const [nodeKey, setNodeKey] = useState(null)
  const [editor] = useLexicalComposerContext()
  const { updateToolbarState } = useToolbarState()

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
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
          // update link editor state
          setIsLinkEditable(isLink)
        }
      })
    })
  }, [editor])

  // paste link into selection
  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        editor.getEditorState().read(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection) && !selection.isCollapsed()) {
            const text = event.clipboardData?.getData('text/plain')?.trim()
            if (!text) return false
            if (!URL_REGEXP.test(text)) return false

            const href = ensureProtocol(removeTracking(text))
            if (!href) return false

            event.preventDefault()
            editor.dispatchCommand(SN_TOGGLE_LINK_COMMAND, href)
            return true
          }
        })
      }, COMMAND_PRIORITY_LOW
    )
  }, [editor, isLinkEditable, nodeKey, anchorElem])

  return isLinkEditable && <LinkEditor isLinkEditable={isLinkEditable} nodeKey={nodeKey} anchorElem={anchorElem} />
}
