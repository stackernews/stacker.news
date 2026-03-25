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
    }, { discrete: true })

    // redirect the original paste event to the bridge
    bridge.dispatchCommand(PASTE_COMMAND, event)

    // export the resulting state as markdown
    let markdown = null
    bridge.update(() => {
      markdown = $lexicalToMarkdown(true)
    }, { discrete: true })

    return markdown
  } catch {
    return null
  }
}, { name: 'sn-markdown-paste-bridge' })

/** redirects rich pastes to the bridge's rich text handler,
 *  the resulting lexical state is then converted to markdown via MDAST
 *  and inserted into the original editor */
export default function MarkdownRichPastePlugin () {
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

        // skip if clipboard lacks rich data (lexical or HTML)
        if (!clipboardData.getData('application/x-lexical-editor') &&
          !clipboardData.getData('text/html')) return false

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
