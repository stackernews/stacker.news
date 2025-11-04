import { $isLinkNode, LinkNode } from '@lexical/link'
import { $isItemMentionNode, ItemMentionNode, $createItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item-mention'
import { $createTextNode } from 'lexical'

export const SN_ITEM_HASHTAG = {
  dependencies: [ItemMentionNode],
  export: (node) => {
    if (!$isItemMentionNode(node)) return null
    return '#' + node.getItemMentionId()
  },
  importRegExp: /\B#(\d+)/,
  regExp: /\B#(\d+)/,
  replace: (textNode, match) => {
    const parent = textNode.getParent()
    if ($isLinkNode(parent)) return

    const [, itemId] = match
    const itemMentionNode = $createItemMentionNode(itemId)
    textNode.replace(itemMentionNode)
  },
  trigger: '#',
  type: 'text-match'
}

export const SN_ITEM_FULL_LINK = {
  dependencies: [LinkNode, ItemMentionNode],
  export: (node) => {
    if (!$isItemMentionNode(node)) return null
    return '#' + node.getItemMentionId()
  },
  importRegExp: /(?:^|\s|\()(https?:\/\/[^/]+\/items\/\d+(?:[/?][^\s)]*)?)/,
  regExp: /(?:^|\s|\()(https?:\/\/[^/]+\/items\/\d+(?:[/?][^\s)]*)?)/,
  replace: (textNode, match) => {
    const parent = textNode.getParent()
    if ($isLinkNode(parent)) return

    const [fullMatch, url] = match
    const itemIdMatch = url.match(/\/items\/(\d+)/)
    if (!itemIdMatch) return

    const itemId = itemIdMatch[1]
    const itemMentionNode = $createItemMentionNode(itemId)
    textNode.replace(itemMentionNode)
    // preserve whitespace to compensate for the regexp
    const startsWithSpace = fullMatch.startsWith(' ')
    if (startsWithSpace) {
      itemMentionNode.insertBefore($createTextNode(' '))
    }
  },
  trigger: '/',
  type: 'text-match'
}
