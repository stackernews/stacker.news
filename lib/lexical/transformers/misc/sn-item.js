import { $isLinkNode, LinkNode } from '@lexical/link'
import { $isItemMentionNode, ItemMentionNode, $createItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item-mention'
import { parseInternalLinks } from '@/lib/url'

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
  importRegExp: new RegExp(`${process.env.NEXT_PUBLIC_URL}/items/\\d+[a-zA-Z0-9/?=]*`, 'i'),
  regExp: new RegExp(`${process.env.NEXT_PUBLIC_URL}/items/\\d+[a-zA-Z0-9/?=]*`, 'i'),
  replace: (textNode, match) => {
    const parent = textNode.getParent()
    if ($isLinkNode(parent)) return

    const [url] = match
    try {
      // parseInternalLinks to extract itemId/commentId from url
      const { itemId, commentId } = parseInternalLinks(url)
      const id = commentId || itemId
      if (!id) return

      const itemMentionNode = $createItemMentionNode(String(id))
      textNode.replace(itemMentionNode)
    } catch (err) {
      console.error('error parsing internal link:', err)
    }
  },
  trigger: '/',
  type: 'text-match'
}
