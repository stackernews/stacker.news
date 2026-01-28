import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, $selectAll, $getSelection, COMMAND_PRIORITY_EDITOR, $isRangeSelection, $getRoot } from 'lexical'
import { $formatBlock } from '@/lib/lexical/commands/formatting/blocks'
import useHeadlessBridge from './use-headless-bridge'
import { $markdownToLexical, $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'
import { $insertMarkdown } from '@/lib/lexical/utils'
import { $toggleLink } from '@/lib/lexical/commands/links'

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
  const bridgeRef = useHeadlessBridge()

  // Markdown Transformer Bridge
  // uses markdown transformers to apply transformations to a markdown selection
  useEffect(() => {
    return editor.registerCommand(USE_TRANSFORMER_BRIDGE, ({ selection, formatType, transformation }) => {
      selection = selection || $getSelection()
      if (!selection || !$isRangeSelection(selection) || selection.isCollapsed()) return false

      // get the markdown from the selection
      const markdown = selection.getTextContent()

      // new markdown to be inserted in the original editor
      let newMarkdown = ''

      // update the bridge editor with single update cycle
      bridgeRef.current.update(() => {
        // make sure we're working with a clean bridge
        $getRoot().clear()

        $markdownToLexical(markdown, true)
        $selectAll()

        const innerSelection = $getSelection()

        switch (formatType) {
          case 'format':
            innerSelection.formatText(transformation)
            break
          case 'block':
            $formatBlock(bridgeRef.current, transformation)
            break
          case 'link':
            $toggleLink(bridgeRef.current, transformation)
            break
        }

        newMarkdown = $lexicalToMarkdown()
        // we're done, clear the bridge
        $getRoot().clear()
      })

      // insert the new markdown in the original editor
      $insertMarkdown(newMarkdown)
      return true
    }, COMMAND_PRIORITY_EDITOR)
  }, [editor, bridgeRef])

  return null
}
