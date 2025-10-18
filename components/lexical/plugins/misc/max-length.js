import { useEffect, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection, RootNode } from 'lexical'
import { $trimTextContentFromAnchor } from '@lexical/selection'
import { $restoreEditorState } from '@lexical/utils'

export function MaxLengthPlugin ({ maxLength }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    // prevent infinite restoration loops by tracking the last restored editor state
    let lastRestoredEditorState = null
    
    // run whenever the RootNode (editor content) changes
    return editor.registerNodeTransform(RootNode, (node) => {
      // get the current selection
      const sel = $getSelection()
      // only proceed if we have a range selection that is collapsed (cursor position)
      if (!$isRangeSelection(sel) || !sel.isCollapsed()) return

      // get the previous editor state to compare text content size
      const prevEditorState = editor.getEditorState()
      const prevTextContentSize = prevEditorState.read(() => {
        node.getTextContentSize()
      })
      
      // get the current text content size
      const textContentSize = node.getTextContentSize()
      
      // only act if the text content size has changed
      if (prevTextContentSize !== textContentSize) {
        // calculate how many characters need to be deleted if over the limit
        const delCount = textContentSize - maxLength
        const anchor = sel.anchor

        // if we're over the character limit, handle the overflow
        if (delCount > 0) {
          // if the previous state was exactly at the limit and we haven't already restored this state,
          // restore to the previous valid state to prevent going over the limit (infinite loop)
          if (prevTextContentSize === maxLength && lastRestoredEditorState !== prevEditorState) {
            lastRestoredEditorState = prevEditorState
            $restoreEditorState(editor, prevEditorState)
          } else {
            // otherwise, trim the excess characters from the current cursor position
            $trimTextContentFromAnchor(editor, anchor, delCount)
          }
        }
      }
    })
  }, [editor, maxLength])

  // calculate remaining characters directly from current editor state
  const remaining = editor.getEditorState().read(() => {
    const root = editor.getEditorState()._nodeMap.get('root')
    const textContentSize = root ? root.getTextContentSize() : 0
    return Math.max(0, maxLength - textContentSize)
  })

  return (
    <div className='text-muted form-text'>{remaining} characters remaining</div>
  )
}