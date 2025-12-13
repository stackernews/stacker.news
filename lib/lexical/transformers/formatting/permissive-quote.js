import { QuoteNode, $isQuoteNode, $createQuoteNode } from '@lexical/rich-text'
import { $createLineBreakNode } from 'lexical'

/** permissive quote transformer, overrides QUOTE transformer in the order of the transformers
 *
 *  rich mode: gets a quote node and creates > text
 *
 *  markdown mode: from > text to quote node
 */
export const PERMISSIVE_QUOTE = {
  dependencies: [QuoteNode],
  export: (node, exportChildren) => {
    if (!$isQuoteNode(node)) {
      return null
    }
    const lines = exportChildren(node).split('\n')
    const output = []
    for (const line of lines) {
      output.push('> ' + line)
    }
    return output.join('\n')
  },
  regExp: /^\s*>\s?/,
  replace: (parentNode, children, _match, isImport) => {
    if (isImport) {
      const previousNode = parentNode.getPreviousSibling()
      if ($isQuoteNode(previousNode)) {
        previousNode.splice(previousNode.getChildrenSize(), 0, [$createLineBreakNode(), ...children])
        parentNode.remove()
        return
      }
    }
    const node = $createQuoteNode()
    node.append(...children)
    parentNode.replace(node)
    if (!isImport) {
      node.select(0, 0)
    }
  },
  type: 'element'
}
