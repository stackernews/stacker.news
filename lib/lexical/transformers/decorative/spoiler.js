import { $convertFromMarkdownString } from '@lexical/markdown'
import { SN_TRANSFORMERS } from '../sn'
import { SpoilerContainerNode, $isSpoilerContainerNode, $createSpoilerContainerNode } from '@/lib/lexical/nodes/formatting/spoiler/container'
import { SpoilerTitleNode, $createSpoilerTitleNode } from '@/lib/lexical/nodes/formatting/spoiler/title'
import { SpoilerContentNode, $createSpoilerContentNode } from '@/lib/lexical/nodes/formatting/spoiler/content'

export const SPOILER = {
  dependencies: [SpoilerContainerNode, SpoilerTitleNode, SpoilerContentNode],
  export: (node, exportChildren) => {
    if (!$isSpoilerContainerNode(node)) return null

    // title and content
    const titleNode = node.getFirstChild()
    const contentNode = node.getLastChild()

    // export text content
    const titleMarkdown = exportChildren(titleNode)
    const contentMarkdown = exportChildren(contentNode)

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
    $convertFromMarkdownString(summaryText, SN_TRANSFORMERS, titleNode)
    $convertFromMarkdownString(contentText, SN_TRANSFORMERS, contentNode)

    // create container and append
    const spoilerContainer = $createSpoilerContainerNode(true)
    spoilerContainer.append(titleNode, contentNode)
    rootNode.append(spoilerContainer)

    if (!isImport) titleNode.select(0, 0)
    return spoilerContainer
  },
  type: 'multiline-element'
}
