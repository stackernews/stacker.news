import { TerritoryMentionNode, $createTerritoryMentionNode, $isTerritoryMentionNode } from '@/lib/lexical/nodes/decorative/mentions/territory'

/** territory mentions transformer
 *
 *  rich mode: gets a territory mention node and creates ~territory
 *
 *  markdown mode: from ~territory to territory mention node
 *
 */
export const TERRITORY_MENTIONS = {
  dependencies: [TerritoryMentionNode],
  export: (node) => {
    if (!$isTerritoryMentionNode(node)) return null
    return '~' + node.getTerritoryMentionName()
  },
  importRegExp: /~([A-Za-z][\w_]+(?:\/[A-Za-z][\w_]+)?)\b/,
  regExp: /~([A-Za-z][\w_]+(?:\/[A-Za-z][\w_]+)?)\b/,
  replace: (textNode, match) => {
    const territoryMentionNode = $createTerritoryMentionNode(match[1])
    textNode.replace(territoryMentionNode)
  },
  trigger: '~',
  type: 'text-match'
}
