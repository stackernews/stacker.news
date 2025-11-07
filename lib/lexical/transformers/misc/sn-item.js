import { $isLinkNode, LinkNode } from '@lexical/link'
import { $isItemMentionNode, ItemMentionNode, $createItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item-mention'
import { parseInternalLinks, SN_ITEM_URL_REGEXP } from '@/lib/url'

/** SN item reference two-way transformer
 *
 *  rich mode: gets an ItemMentionNode and creates the full item URL
 *
 *  markdown mode: from the full item URL to ItemMentionNode (\#itemId)
 *
 */
export const SN_ITEM_FULL_LINK = {
  dependencies: [LinkNode, ItemMentionNode],
  export: (node) => {
    if (!$isItemMentionNode(node)) return null
    return process.env.NEXT_PUBLIC_URL + '/items/' + node.getItemMentionId()
  },
  importRegExp: SN_ITEM_URL_REGEXP,
  regExp: SN_ITEM_URL_REGEXP,
  replace: (textNode, match) => {
    const parent = textNode.getParent()
    if ($isLinkNode(parent)) return

    const [url] = match
    const id = getItemID(url)
    if (id) {
      const itemMentionNode = $createItemMentionNode(id)
      textNode.replace(itemMentionNode)
    }
  },
  trigger: '/',
  type: 'text-match'
}

export function getItemID (url) {
  try {
    // parseInternalLinks to extract itemId/commentId from url
    const { itemId, commentId } = parseInternalLinks(url)
    return commentId || itemId
  } catch (err) {
    return null
  }
}
