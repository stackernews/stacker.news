import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { COMMAND_PRIORITY_HIGH, PASTE_COMMAND, PASTE_TAG, $getSelection, $getRoot, $isRangeSelection } from 'lexical'
import { $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'
import { $insertText } from '@/lib/lexical/utils'
import { objectKlassEquals } from '@lexical/utils'
import { withDisposableBridge } from '@/components/editor/hooks/use-headless-bridge'

/** redirects a paste event to a disposable rich text bridge,
 *  and exports the resulting EditorState as markdown via MDAST */
const getMarkdownFromPaste = withDisposableBridge((bridge, event) => {
  try {
    // prepare the bridge by clearing the root and creating a new selection
    bridge.update(() => {
      const root = $getRoot()
      root.clear()
      root.selectEnd()
    })

    // redirect the original paste event to the bridge
    bridge.dispatchCommand(PASTE_COMMAND, event)

    // export the resulting state as markdown
    let markdown = null
    bridge.update(() => {
      markdown = $lexicalToMarkdown()
    })

    return markdown
  } catch {
    return null
  }
}, { name: 'sn-markdown-paste-bridge' })

/** redirect markdown mode pastes to a disposable rich text bridge,
 *  which will convert the pasted rich content into markdown via MDAST
 *
 *  the resulting markdown is then inserted into the original editor */
export default function MarkdownPastePlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false

        const clipboardData = objectKlassEquals(event, window.ClipboardEvent)
          ? event.clipboardData
          : null
        if (!clipboardData) return false

        const markdown = getMarkdownFromPaste(event)
        if (!markdown) return false

        editor.update(() => {
          // trim whitespaces while inserting
          $insertText(markdown, true)
        }, { tag: PASTE_TAG })

        return true
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor])

  return null
}
