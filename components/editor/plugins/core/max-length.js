import { useEffect, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection, RootNode, $getRoot } from 'lexical'
import { $trimTextContentFromAnchor } from '@lexical/selection'
import { $restoreEditorState } from '@lexical/utils'
import { MAX_POST_TEXT_LENGTH } from '@/lib/constants'

function getRemaining (editor, maxLength) {
  return editor.getEditorState().read(() => {
    const root = $getRoot()
    const textContentSize = root ? root.getTextContentSize() : 0
    return Math.max(0, maxLength - textContentSize)
  })
}

/**
 * plugin that enforces maximum text length and displays character count
 * @param {number} props.lengthOptions.maxLength - maximum character limit
 * @param {boolean} props.lengthOptions.show - whether to always show character count
 * @returns {JSX.Element|null} character count display or null
 */
export function MaxLengthPlugin ({ lengthOptions = {} }) {
  const [editor] = useLexicalComposerContext()

  // if no limit is set, MAX_POST_TEXT_LENGTH is used
  // rendering is disabled if not requested
  const { maxLength = MAX_POST_TEXT_LENGTH, show = false } = lengthOptions

  // track remaining characters with state so it updates on editor changes
  const [remaining, setRemaining] = useState(() => {
    return getRemaining(editor, maxLength)
  })

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

  // update remaining characters whenever editor content changes
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        setRemaining(getRemaining(editor, maxLength))
      })
    })
  }, [editor, maxLength])

  if (show || remaining < 10) {
    return (
      <div className='text-muted form-text'>{remaining} characters remaining</div>
    )
  }

  return null
}
