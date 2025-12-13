import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { SN_TRANSFORMERS_BASE } from '../sn'
import { ALIGN_TRANSFORMER } from '../formatting/alignments'
import { SpoilerContainerNode, $isSpoilerContainerNode, $createSpoilerContainerNode } from '@/lib/lexical/nodes/formatting/spoiler/container'
import { SpoilerTitleNode, $createSpoilerTitleNode } from '@/lib/lexical/nodes/formatting/spoiler/title'
import { SpoilerContentNode, $createSpoilerContentNode } from '@/lib/lexical/nodes/formatting/spoiler/content'

// Transformers for exporting spoiler content (includes alignment but not spoiler itself to avoid recursion)
const SPOILER_EXPORT_TRANSFORMERS = [...SN_TRANSFORMERS_BASE, ALIGN_TRANSFORMER]

export const SPOILER = {
  dependencies: [SpoilerContainerNode, SpoilerTitleNode, SpoilerContentNode],
  export: (node) => {
    if (!$isSpoilerContainerNode(node)) return null

    // title and content
    const titleNode = node.getFirstChild()
    const contentNode = node.getLastChild()

    // export children with proper markdown syntax (headings, lists, etc.)
    const titleMarkdown = $convertToMarkdownString(SPOILER_EXPORT_TRANSFORMERS, titleNode)
    const contentMarkdown = $convertToMarkdownString(SPOILER_EXPORT_TRANSFORMERS, contentNode)

    return `<details><summary>${titleMarkdown}</summary>\n\n${contentMarkdown}\n\n</details>`
  },
  // TODO: only this structure gets transformed
  /*
   * <details><summary>Summary text</summary>
   * Content text
   * </details>
   */
  regExpStart: /<details>\s*<summary>/,
  regExpEnd: /<\/details>/,
  replace: (rootNode, _children, _startMatch, _endMatch, linesInBetween, isImport) => {
    const fullText = (linesInBetween || []).join('\n')

    // extract summary and content
    const summaryMatch = fullText.match(/^(.*?)<\/summary>\s*/s)
    if (!summaryMatch) return null

    const summaryText = summaryMatch[1].trim()
    const contentText = fullText.slice(summaryMatch[0].length).trim()

    // create spoiler nodes
    const titleNode = $createSpoilerTitleNode()
    const contentNode = $createSpoilerContentNode()

    // parse summary and content as markdown using SN transformers
    $convertFromMarkdownString(summaryText, SN_TRANSFORMERS_BASE, titleNode)
    $convertFromMarkdownString(contentText, SN_TRANSFORMERS_BASE, contentNode)

    // create container and append
    const spoilerContainer = $createSpoilerContainerNode(true)
    spoilerContainer.append(titleNode, contentNode)
    rootNode.append(spoilerContainer)

    if (!isImport) titleNode.select(0, 0)
    return spoilerContainer
  },
  type: 'multiline-element'
}
