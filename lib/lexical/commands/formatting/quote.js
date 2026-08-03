import { $createParagraphNode, $isRangeSelection, $isRootNode } from 'lexical'
import { $createQuoteNode, $isQuoteNode } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $findTopLevelElement } from '@/lib/lexical/commands/utils'
import { $isBlockElement } from '@/lib/lexical/nodes/utils'

/** moves a quote's children out of it, wrapping loose inline children in paragraphs
 * this preserves nested blocks (eg code blocks inside quotes) which a plain
 * paragraph conversion would destroy
 * @param {Object} quote - quote node to unwrap
 */
const $unwrapQuote = (quote) => {
  let insertionPoint = quote
  for (const child of quote.getChildren()) {
    if ($isBlockElement(child)) {
      insertionPoint.insertAfter(child)
      insertionPoint = child
    } else {
      const paragraph = $createParagraphNode()
      insertionPoint.insertAfter(paragraph)
      paragraph.append(child)
      insertionPoint = paragraph
    }
  }
  quote.remove()
}

/** unwraps the top-level quote nodes touched by a selection
 * @param {Object} selection - lexical selection
 * @returns {boolean} true if any quote was unwrapped
 */
export function $unwrapSelectedQuotes (selection) {
  if (!$isRangeSelection(selection)) return false

  const quotes = new Set()
  for (const node of selection.getNodes()) {
    const topLevelElement = $findTopLevelElement(node)
    if ($isQuoteNode(topLevelElement)) quotes.add(topLevelElement)
  }

  for (const quote of quotes) {
    $unwrapQuote(quote)
  }

  return quotes.size > 0
}

/** wraps the top-level elements touched by a selection in quote nodes
 * all-paragraph selections keep the previous block-conversion behavior,
 * anything else is wrapped so the original block (eg a code block) is preserved
 * @param {Object} selection - lexical selection
 * @returns {boolean} true if elements were wrapped
 */
export function $wrapSelectedInQuote (selection) {
  if (!$isRangeSelection(selection)) return false

  const topLevelElements = new Set()
  for (const node of selection.getNodes()) {
    const element = $findTopLevelElement(node)
    if (!$isRootNode(element)) topLevelElements.add(element)
  }

  if (topLevelElements.size === 0) return false

  if ([...topLevelElements].every(node => node.getType() === 'paragraph')) {
    $setBlocksType(selection, () => $createQuoteNode())
    return true
  }

  for (const element of topLevelElements) {
    const quote = $createQuoteNode()
    element.replace(quote)
    quote.append(element)
  }

  return true
}
