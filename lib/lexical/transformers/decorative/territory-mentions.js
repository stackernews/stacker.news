import { TerritoryNode, $createTerritoryNode, $isTerritoryNode } from '@/lib/lexical/nodes/decorative/mentions/territory-mention'

/** territory mentions transformer
 *
 *  rich mode: gets a territory mention node and creates ~territory
 *
 *  markdown mode: from ~territory to territory mention node
 *
 */
export const TERRITORY_MENTIONS = {
  dependencies: [TerritoryNode],
  export: (node) => {
    if (!$isTerritoryNode(node)) return null
    return '~' + node.getTerritoryName()
  },
  importRegExp: /~([A-Za-z][\w_]+(?:\/[A-Za-z][\w_]+)?)\b/,
  regExp: /~([A-Za-z][\w_]+(?:\/[A-Za-z][\w_]+)?)\b/,
  replace: (textNode, match) => {
    const territoryNode = $createTerritoryNode(match[1])
    textNode.replace(territoryNode)
  },
  trigger: '~',
  type: 'text-match'
}
