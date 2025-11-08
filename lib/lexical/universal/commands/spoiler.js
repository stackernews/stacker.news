import { createCommand, COMMAND_PRIORITY_EDITOR, $getSelection, $isRangeSelection, $createParagraphNode, $createTextNode } from 'lexical'
import { $createSpoilerContainerNode } from '@/lib/lexical/nodes/formatting/spoiler/container'
import { $createSpoilerSummaryNode } from '@/lib/lexical/nodes/formatting/spoiler/summary'
import { $createSpoilerContentNode } from '@/lib/lexical/nodes/formatting/spoiler/details'
import { $insertNodeToNearestRoot } from '@lexical/utils'

/**
 * command to insert a spoiler element with collapsible content
 * @param {string} text - summary text for the spoiler
 * @returns {boolean} true if command was handled
 */
export const SN_INSERT_SPOILER_COMMAND = createCommand('SN_INSERT_SPOILER_COMMAND')

/**
 * registers command to insert spoiler elements
 * @param {Object} params.editor - lexical editor instance
 * @returns {Function} unregister function or false if SpoilerNode not available
 */
export function registerSNInsertSpoilerCommand ({ editor }) {
  return editor.registerCommand(SN_INSERT_SPOILER_COMMAND, ({ text = 'Spoiler' } = {}) => {
    const selection = $getSelection()

    let summaryText = text
    // if there's selected text, use it as the summary
    if (!text && selection && $isRangeSelection(selection)) {
      const selectedText = selection.getTextContent()
      if (selectedText) {
        summaryText = selectedText
      }
    }

    const title = $createSpoilerSummaryNode()
    const paragraph = $createParagraphNode()
    $insertNodeToNearestRoot(
      $createSpoilerContainerNode(false).append(
        title.append(paragraph),
        $createSpoilerContentNode().append($createParagraphNode().append($createTextNode(summaryText)))
      )
    )
    paragraph.select()

    return true
  }, COMMAND_PRIORITY_EDITOR)
}
