import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { COMMAND_PRIORITY_HIGH, PASTE_COMMAND, PASTE_TAG, $getSelection, $getRoot, $isRangeSelection } from 'lexical'
import useHeadlessBridge from '@/components/editor/hooks/use-headless-bridge'
import { $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'
import { $insertText } from '@/lib/lexical/utils'
import { objectKlassEquals } from '@lexical/utils'

/** redirects a paste event to the bridge's rich text handler,
 *  and exports the resulting nodes as markdown via MDAST */
function getMarkdownFromPaste (bridge, event) {
  // prepare the bridge by clearing the root and creating a new selection
  bridge.update(() => {
    const root = $getRoot()
    root.clear()
    root.selectEnd()
  })

  // redirect the original paste event to the bridge
  bridge.dispatchCommand(PASTE_COMMAND, event)

  // export the resulting nodes as markdown
  let markdown = ''
  bridge.update(() => {
    markdown = $lexicalToMarkdown(true)
    $getRoot().clear()
  })

  return markdown
}

/** redirect markdown mode pastes to the bridge's rich text handler,
 *  which will convert the pasted rich content into markdown via MDAST
 *
 *  the resulting markdown is then inserted into the original editor */
export default function MarkdownPastePlugin () {
  const [editor] = useLexicalComposerContext()
  const bridgeRef = useHeadlessBridge()

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

        const markdown = getMarkdownFromPaste(bridgeRef.current, event)
        if (!markdown) return false

        editor.update(() => {
          $insertText(markdown, true)
        }, { tag: PASTE_TAG })

        return true
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor, bridgeRef])

  return null
}
