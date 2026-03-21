import { $getRoot } from 'lexical'
import { $getLexicalContent, $generateNodesFromSerializedNodes } from '@lexical/clipboard'
import { withDisposableBridge } from '@/components/editor/hooks/use-headless-bridge'
import { $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'

/**
 * extracts markdown from a Lexical selection through a headless bridge
 * @param editor - Lexical editor instance
 * @returns markdown string or null if no markdown was found
 */
export const getMarkdownFromSelection = withDisposableBridge((bridge, editor) => {
  try {
    let lexicalJson = null
    editor.read(() => {
      lexicalJson = $getLexicalContent(editor)
    })
    if (!lexicalJson) return null

    const { nodes: serializedNodes } = JSON.parse(lexicalJson)
    if (!serializedNodes?.length) return null
    let markdown = null
    bridge.update(() => {
      // prepare the bridge by clearing the root and creating a new selection
      const root = $getRoot()
      root.clear()
      root.selectEnd()

      // generate nodes from serialized nodes
      const nodes = $generateNodesFromSerializedNodes(serializedNodes)
      root.append(...nodes)

      // export the resulting state as markdown
      markdown = $lexicalToMarkdown()?.trim()
    }, { discrete: true })

    return markdown
  } catch {
    return null
  }
}, { name: 'sn-quote-bridge' })
