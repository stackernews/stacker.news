import { TerritoryNode, $createTerritoryNode, $isTerritoryNode } from '@/lib/lexical/nodes/decorative/mentions/territory-mention'

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
