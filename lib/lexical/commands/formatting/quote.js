import { $isRangeSelection } from 'lexical'
import { $isQuoteNode } from '@lexical/rich-text'
import { $findTopLevelElement } from '@/lib/lexical/commands/utils'

export function $unwrapSelectedQuotes (selection) {
  if (!$isRangeSelection(selection)) return false

  const quotes = new Set()
  for (const node of selection.getNodes()) {
    const topLevelElement = $findTopLevelElement(node)
    if ($isQuoteNode(topLevelElement)) quotes.add(topLevelElement)
  }

  for (const quote of quotes) {
    for (const child of quote.getChildren()) quote.insertBefore(child)
    quote.remove()
  }

  return quotes.size > 0
}
