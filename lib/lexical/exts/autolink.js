import { defineExtension } from '@lexical/extension'
import { $createItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item'
import { $createEmbedNode } from '@/lib/lexical/nodes/content/embed'
import { $createMediaNode } from '@/lib/lexical/nodes/content/media'
import { parseInternalLinks, parseEmbedUrl, ensureProtocol, getLinkAttributes } from '@/lib/url'
import { AutoLinkNode, $createLinkNode } from '@lexical/link'
import { $isParagraphNode, $createTextNode } from 'lexical'

// check if a bare link is standalone in its own paragraph
function isStandaloneBareLink (node) {
  const parent = node.getParent()
  // must be in a paragraph with no siblings
  return $isParagraphNode(parent) && parent.getChildren()?.length === 1
}

// helper to get embed info from url
function getEmbed (src) {
  const embed = parseEmbedUrl(src)
  return embed ? { ...embed, src } : { provider: null }
}

// note: this doesn't support formatting, e.g. **https://stacker.news**
// because we're using `MediaNode` as a step for media checks
export const AutoLinkExtension = defineExtension({
  name: 'AutoLinkExtension',
  register: (editor) => {
    return editor.registerNodeTransform(AutoLinkNode, (node) => {
      // ensure protocol to avoid parsing external links as internal ones
      const url = ensureProtocol(node.getURL())

      // step 1: check for item mention
      try {
        const { itemId, commentId, linkText } = parseInternalLinks(url)
        if (itemId || commentId) {
          const mentionNode = $createItemMentionNode({
            id: commentId || itemId,
            text: linkText,
            url
          })
          node.replace(mentionNode)
          return
        }
      } catch {}

      // only if the link is standalone in its own paragraph
      // step 2: check for embed
      if (isStandaloneBareLink(node)) {
        const embed = getEmbed(url)
        if (embed.provider) {
          const embedNode = $createEmbedNode({ provider: embed.provider, src: embed.src, id: embed.id, meta: embed.meta })
          // replace the parent paragraph with the embed node
          const parent = node.getParent()
          if (parent.getType() === 'paragraph') {
            parent.replace(embedNode)
            // while live editing, we want to move selection after destroying the previous
            embedNode.selectEnd()
            return
          }
          node.replace(embedNode)
          return
        }

        // step 3: check for media
        const mediaNode = $createMediaNode({ src: url, autolink: true })
        node.replace(mediaNode)
        return
      }

      // step 4: fallback to full link node
      const { target, rel } = getLinkAttributes(url)
      const linkNode = $createLinkNode(url, {
        title: url,
        target,
        rel
      }).append($createTextNode(url))
      node.replace(linkNode)
    })
  }
})
