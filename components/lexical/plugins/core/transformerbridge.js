import { useRef, useCallback, useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, $selectAll, $getSelection, COMMAND_PRIORITY_EDITOR, $getRoot } from 'lexical'
import { RichTextExtension } from '@lexical/rich-text'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { $findTopLevelElement } from '@/components/lexical/universal/utils'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { ListExtension, CheckListExtension } from '@lexical/list'
import { buildEditorFromExtensions, defineExtension } from '@lexical/extension'
import { $formatBlock } from '@/components/lexical/universal/commands/formatting/blocks'
import { CodeHighlighterShikiExtension } from '@lexical/code-shiki'

export const USE_TRANSFORMER_BRIDGE = createCommand('USE_TRANSFORMER_BRIDGE')

export default function TransformerBridgePlugin ({ nodes }) {
  const [editor] = useLexicalComposerContext()
  const bridge = useRef(null)

  // headless editor used as bridge between markdown and lexical
  const createBridge = useCallback(() => {
    if (bridge.current) return bridge.current
    bridge.current = buildEditorFromExtensions(
      defineExtension({
        name: 'transformerBridge',
        dependencies: [RichTextExtension, ListExtension, CheckListExtension, CodeHighlighterShikiExtension],
        nodes
      })
    )
    return bridge.current
  }, [nodes])

  // create the bridge if it doesn't exist and dispose of it when we're done
  useEffect(() => {
    createBridge()
    return () => {
      if (bridge.current) {
        bridge.current.dispose()
        bridge.current = null
      }
    }
  }, [editor, createBridge])

  // Markdown Transformer Bridge
  // uses markdown transformers to apply transformations to a markdown selection
  useEffect(() => {
    return editor.registerCommand(USE_TRANSFORMER_BRIDGE, ({ selection, formatType, transformation }) => {
      const transformerBridge = createBridge()
      if (!transformerBridge) return false

      if (!selection) selection = $getSelection()
      // get the markdown from the selection
      const markdown = selection.getTextContent()
      console.log('markdown', markdown)

      // new markdown to be inserted in the original editor
      let newMarkdown = ''

      // update the bridge editor with single update cycle
      transformerBridge.update(() => {
        // make sure we're working with a clean bridge
        $getRoot().clear()

        $convertFromMarkdownString(markdown, SN_TRANSFORMERS, undefined, transformation !== 'code')
        $selectAll()
        const innerSelection = $getSelection()

        switch (formatType) {
          case 'format':
            innerSelection.formatText(transformation)
            break
          case 'block':
            $formatBlock(transformerBridge, transformation)
            break
          case 'elementFormat':
            innerSelection.getNodes()?.forEach(node => {
              const element = $findTopLevelElement(node)
              if (element && element.setFormat) {
                element.setFormat(transformation || 'left')
              }
            })
            break
        }

        newMarkdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, transformation !== 'code')
        // we're done, clear the bridge
        $getRoot().clear()
      })

      // insert the new markdown in the original editor
      selection.insertText(newMarkdown)
      return true
    }, COMMAND_PRIORITY_EDITOR)
  }, [editor, createBridge, SN_TRANSFORMERS])

  return null
}
