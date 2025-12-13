import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, $selectAll, $getSelection, COMMAND_PRIORITY_EDITOR, $getRoot } from 'lexical'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { $findTopLevelElement } from '@/lib/lexical/universal/utils'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $formatBlock } from '@/lib/lexical/universal/commands/formatting/blocks'
import { CodeHighlighterShikiExtension } from '@lexical/code-shiki'
import useHeadlessBridge from './use-headless-bridge'

/** command to transform markdown selections using a headless lexical editor
 * @param {Object} params.selection - selection to transform
 * @param {string} params.formatType - format type to transform
 * @param {string} params.transformation - transformation to apply
 * @returns {boolean} true if transformation was applied
 */
export const USE_TRANSFORMER_BRIDGE = createCommand('USE_TRANSFORMER_BRIDGE')

/** bridge plugin that transforms markdown selections using a headless lexical editor,
 *  registers USE_TRANSFORMER_BRIDGE command to transform markdown selections
 */
export default function TransformerBridgePlugin () {
  const [editor] = useLexicalComposerContext()
  const bridge = useHeadlessBridge({ extensions: [CodeHighlighterShikiExtension] })

  // Markdown Transformer Bridge
  // uses markdown transformers to apply transformations to a markdown selection
  useEffect(() => {
    return editor.registerCommand(USE_TRANSFORMER_BRIDGE, ({ selection, formatType, transformation }) => {
      if (!selection) selection = $getSelection()
      // get the markdown from the selection
      const markdown = selection.getTextContent()

      // new markdown to be inserted in the original editor
      let newMarkdown = ''

      // update the bridge editor with single update cycle
      bridge.current.update(() => {
        // make sure we're working with a clean bridge
        $getRoot().clear()

        $convertFromMarkdownString(markdown, SN_TRANSFORMERS, undefined, false)
        $selectAll()
        const innerSelection = $getSelection()

        switch (formatType) {
          case 'format':
            innerSelection.formatText(transformation)
            break
          case 'block':
            $formatBlock(bridge.current, transformation)
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

        newMarkdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, false)
        // we're done, clear the bridge
        $getRoot().clear()
      })

      // insert the new markdown in the original editor
      selection.insertText(newMarkdown)
      return true
    }, COMMAND_PRIORITY_EDITOR)
  }, [editor, bridge])

  return null
}
