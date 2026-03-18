import { $getRoot } from 'lexical'
import { $getLexicalContent, $generateNodesFromSerializedNodes } from '@lexical/clipboard'
import { createHeadlessBridge } from '@/components/editor/hooks/use-headless-bridge'
import { $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'

/**
 * extracts markdown from a Lexical selection through a headless bridge
 * @param editor - Lexical editor instance
 * @returns markdown string or null if no markdown was found
 */
export function getMarkdownFromSelection (editor) {
  const bridge = createHeadlessBridge({ name: 'sn-quote-bridge' })

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
      const nodes = $generateNodesFromSerializedNodes(serializedNodes)
      $getRoot().append(...nodes)
      markdown = $lexicalToMarkdown()?.trim()
    })

    return markdown
  } catch {
    return null
  } finally {
    bridge.dispose()
  }
}
