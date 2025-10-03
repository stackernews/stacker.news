import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useState } from 'react'
import { $isLinkNode, $isAutoLinkNode } from '@lexical/link'
import { useToolbarState } from '@/components/lexical/contexts/toolbar'
import { $getSelection, $isRangeSelection, $isNodeSelection } from 'lexical'
import { getSelectedNode } from '@/components/lexical/utils/selection'
import { $findMatchingParent } from '@lexical/utils'
import LinkEditor from './linkeditor'

export default function LinkTransformationPlugin ({ anchorElem }) {
  const [isLinkEditable, setIsLinkEditable] = useState(false)
  const [nodeKey, setNodeKey] = useState(null)
  const [editor] = useLexicalComposerContext()
  const { updateToolbarState } = useToolbarState()

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const focusNode = getSelectedNode(selection)
          const focusLinkNode = $findMatchingParent(focusNode, $isLinkNode)
          const focusAutoLinkNode = $findMatchingParent(focusNode, $isAutoLinkNode)
          if (!(focusLinkNode || focusAutoLinkNode)) {
            updateToolbarState('isLink', false)
            if (editor.isEditable()) {
              console.log('updateToolbarState isLink false')
              setNodeKey(null)
              setIsLinkEditable(false)
            }
          } else {
            updateToolbarState('isLink', true)
            if (editor.isEditable()) {
              console.log('updateToolbarState isLink true')
              setNodeKey(focusLinkNode.getKey() || focusAutoLinkNode.getKey())
              setIsLinkEditable(true)
            }
          }
        } else if ($isNodeSelection(selection)) {
          const nodes = selection.getNodes()
          if (nodes.length > 0) {
            const node = nodes[0]
            const parent = node.getParent()
            updateToolbarState('isLink', $isLinkNode(parent) || $isLinkNode(node))
            if (editor.isEditable()) {
              console.log('updateToolbarState isLink true')
              setNodeKey(node.getKey())
              setIsLinkEditable(true)
            }
          }
        }
      })
    })
  }, [editor])

  return isLinkEditable && <LinkEditor isLinkEditable={isLinkEditable} nodeKey={nodeKey} anchorElem={anchorElem} />
}
