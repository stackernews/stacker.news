import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, $selectAll, $getSelection, COMMAND_PRIORITY_EDITOR, $isRangeSelection, $getRoot } from 'lexical'
import { $formatBlock } from '@/lib/lexical/commands/formatting/blocks'
import useHeadlessBridge from '@/components/editor/hooks/use-headless-bridge'
import { $markdownToLexical, $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'
import { $insertMarkdown, $debugNodeToJSON } from '@/lib/lexical/utils'
import { $toggleLink } from '@/lib/lexical/commands/links'

// blocks that we should split in paragraphs
const SPLIT_IN_PARAGRAPHS = ['bullet', 'number', 'check']

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
      // if we don't have a selection or it's not a range selection, bail
      if (!$isRangeSelection(selection) || selection.isCollapsed()) return false

      // get the markdown from the selection
      const markdown = selection.getTextContent()
      // new markdown to be inserted in the original editor
      let newMarkdown = ''

      // bridge editor update cycle
      bridgeRef.current.update(() => {
        // make sure we're working with a clean bridge
        $getRoot().clear()

        // transform markdown to lexical nodes
        $markdownToLexical(markdown, SPLIT_IN_PARAGRAPHS.includes(transformation))

        // DEBUG: what are we transforming?
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Transformer Bridge] BEFORE TRANSFORMATION root with children', $debugNodeToJSON($getRoot()))
        }

        // bridge editor selection
        $selectAll()
        const innerSelection = $getSelection()

        // if we have a selection, apply the transformation
        if (innerSelection) {
          switch (formatType) {
            case 'format':
              innerSelection.formatText(transformation)
              break
            case 'block':
              $formatBlock(bridgeRef.current, transformation)
              break
            case 'link':
              $toggleLink(bridgeRef.current)
              break
          }

          // get the new markdown from the bridge editor
          newMarkdown = $lexicalToMarkdown()
        }

        // we're done, clear the bridge
        $getRoot().clear()
      })

      // if we don't have new markdown, bail
      if (!newMarkdown) return false

      // insert the new markdown into the original editor
      $insertMarkdown(newMarkdown)
      return true
    }, COMMAND_PRIORITY_EDITOR)
  }, [editor, bridgeRef])

  return null
}
