import { $createTextNode } from 'lexical'
import { $createLinkNode } from '@lexical/link'
import { $createMediaNode } from '@/lib/lexical/nodes/content/media'
import { $createItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item'
import { $createEmbedNode } from '@/lib/lexical/nodes/content/embeds'
import { parseInternalLinks, parseEmbedUrl, ensureProtocol } from '@/lib/url'

const getEmbed = (src) => {
  const href = ensureProtocol(src)
  const embed = parseEmbedUrl(href)
  return embed ? { ...embed, src: href } : { provider: null }
}

// bare link to item mention
export const ITEM_MENTION_FROM_LINK = {
  priority: 10,
  mdastType: 'link',
  fromMdast: (node) => {
    if (node.type !== 'link') return null
    const linkText = node.children?.[0]?.value
    if (linkText !== node.url) return null
    try {
      const { itemId, commentId, linkText: itemText } = parseInternalLinks(node.url)
      if (itemId || commentId) {
        return $createItemMentionNode({ id: commentId || itemId, text: itemText, url: node.url })
      }
    } catch {}
    return null
  }
}

// bare link to embed
export const EMBED_FROM_LINK = {
  priority: 10,
  mdastType: 'link',
  fromMdast: (node) => {
    if (node.type !== 'link') return null
    const linkText = node.children?.[0]?.value
    if (linkText !== node.url) return null
    const embed = getEmbed(node.url)
    if (embed.provider) {
      return $createEmbedNode(embed.provider, embed.src, embed.id, embed.meta)
    }
    return null
  }
}

// bare link to media
export const MEDIA_FROM_LINK = {
  priority: 5,
  mdastType: 'link',
  fromMdast: (node) => {
    if (node.type !== 'link') return null
    const linkText = node.children?.[0]?.value
    if (linkText !== node.url) return null
    return $createMediaNode({ src: node.url })
  }
}

// default link
export const LINK = {
  type: 'link',
  mdastType: 'link',
  toMdast: (node, visitChildren) => ({
    type: 'link',
    url: node.getURL(),
    title: node.getTitle() || null,
    children: node.getChildren().flatMap(visitChildren)
  }),
  fromMdast: (node, visitChildren) => {
    if (node.type !== 'link') return null
    const link = $createLinkNode(node.url, {
      title: node.title,
      target: '_blank',
      rel: 'noopener noreferrer'
    })
    link.append(...(node.children?.length ? visitChildren(node.children) : [$createTextNode(node.url)]))
    return link
  },
  toMarkdown: (node, serialize) => {
    const title = node.title ? ` "${node.title}"` : ''
    return `[${serialize(node.children)}](${node.url}${title})`
  }
}

// media/images
export const MEDIA = {
  type: 'media',
  mdastType: 'image',
  toMdast: (node) => ({
    type: 'image',
    url: node.getSrc(),
    alt: node.getAltText() || '',
    title: null
  }),
  fromMdast: (node) => {
    if (node.type !== 'image') return null
    return $createMediaNode({ src: node.url, altText: node.alt || '' })
  },
  toMarkdown: (node) => `![${node.alt || ''}](${node.url})\n\n`
}

// embed output
export const EMBED = {
  type: 'embed',
  mdastType: 'embed',
  toMdast: (node) => ({
    type: 'embed',
    url: node.getSrc(),
    provider: node.getProvider?.(),
    data: { id: node.getId?.(), meta: node.getMeta?.() }
  }),
  toMarkdown: (node) => `${node.url}\n\n`
}

// item mention output
export const ITEM_MENTION = {
  type: 'item-mention',
  mdastType: 'itemMention',
  toMdast: (node) => ({
    type: 'itemMention',
    url: node.getURL(),
    id: node.getID?.(),
    text: node.getText?.()
  }),
  toMarkdown: (node) => `${node.url}\n\n`
}

export default [
  ITEM_MENTION_FROM_LINK,
  EMBED_FROM_LINK,
  MEDIA_FROM_LINK,
  LINK,
  MEDIA,
  EMBED,
  ITEM_MENTION
]
