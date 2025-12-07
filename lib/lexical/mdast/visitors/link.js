import { $createTextNode } from 'lexical'
import { $createLinkNode, $isLinkNode } from '@lexical/link'
import { $createItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item'
import { $createEmbedNode, $isEmbedNode } from '@/lib/lexical/nodes/content/embeds'
import { $createMediaNode, $isMediaNode } from '@/lib/lexical/nodes/content/media'
import { parseInternalLinks, parseEmbedUrl, ensureProtocol } from '@/lib/url'

// helper to check if link is a "bare link" (text matches url)
function isBareLink (mdastNode) {
  const linkText = mdastNode.children?.[0]?.value
  return linkText === mdastNode.url
}

// helper to get embed info from url
function getEmbed (src) {
  const href = ensureProtocol(src)
  const embed = parseEmbedUrl(href)
  return embed ? { ...embed, src: href } : { provider: null }
}

// bare link -> item mention (highest priority)
// recognizes stacker.news item/comment links
export const MdastItemMentionFromLinkVisitor = {
  testNode: 'link',
  priority: 20,
  visitNode ({ mdastNode, lexicalParent, actions }) {
    if (!isBareLink(mdastNode)) {
      actions.nextVisitor()
      return
    }

    try {
      const { itemId, commentId, linkText } = parseInternalLinks(mdastNode.url)
      if (itemId || commentId) {
        const node = $createItemMentionNode({
          id: commentId || itemId,
          text: linkText,
          url: mdastNode.url
        })
        // decorator nodes don't have children, just append directly
        lexicalParent.append(node)
        return
      }
    } catch {}

    actions.nextVisitor()
  }
}

// bare link -> embed (high priority)
// recognizes youtube, twitter, etc
export const MdastEmbedFromLinkVisitor = {
  testNode: 'link',
  priority: 15,
  visitNode ({ mdastNode, lexicalParent, actions }) {
    if (!isBareLink(mdastNode)) {
      actions.nextVisitor()
      return
    }

    const embed = getEmbed(mdastNode.url)
    if (embed.provider) {
      const node = $createEmbedNode({ provider: embed.provider, src: embed.src, id: embed.id, meta: embed.meta })
      // decorator nodes don't have children, just append directly
      lexicalParent.append(node)
      return
    }

    actions.nextVisitor()
  }
}

// bare link -> media (medium priority)
// fallback for other bare links - treated as media
export const MdastMediaFromLinkVisitor = {
  testNode: 'link',
  priority: 10,
  visitNode ({ mdastNode, lexicalParent, actions }) {
    if (!isBareLink(mdastNode)) {
      actions.nextVisitor()
      return
    }

    const node = $createMediaNode({ src: mdastNode.url })
    // decorator nodes don't have children, just append directly
    lexicalParent.append(node)
  }
}

// regular link (default priority)
export const MdastLinkVisitor = {
  testNode: 'link',
  visitNode ({ mdastNode, actions }) {
    const link = $createLinkNode(mdastNode.url, {
      title: mdastNode.title,
      target: mdastNode.target === null ? '' : (mdastNode.target || '_blank'),
      rel: mdastNode.rel === null ? '' : (mdastNode.rel || 'noopener nofollow noreferrer')
    })

    // if no children, use url as text
    if (!mdastNode.children?.length) {
      link.append($createTextNode(mdastNode.url))
    }

    actions.addAndStepInto(link)
  }
}

// lexical -> mdast: regular link
export const LexicalLinkVisitor = {
  testLexicalNode: $isLinkNode,
  visitLexicalNode ({ lexicalNode, actions }) {
    actions.addAndStepInto('link', {
      url: lexicalNode.getURL(),
      title: lexicalNode.getTitle()
    })
  }
}

// lexical -> mdast: embed outputs plain text url
export const LexicalEmbedVisitor = {
  testLexicalNode: $isEmbedNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    actions.appendToParent(mdastParent, {
      type: 'text',
      value: lexicalNode.getSrc() || ''
    })
  }
}

// lexical -> mdast: media outputs image syntax
export const LexicalMediaVisitor = {
  testLexicalNode: $isMediaNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    actions.appendToParent(mdastParent, {
      type: 'image',
      url: lexicalNode.getSrc(),
      alt: lexicalNode.getAltText() || '',
      title: null
    })
  }
}

// mdast -> lexical: image
export const MdastImageVisitor = {
  testNode: 'image',
  visitNode ({ mdastNode, lexicalParent }) {
    const node = $createMediaNode({
      src: mdastNode.url,
      altText: mdastNode.alt || ''
    })
    // decorator nodes don't have children, just append directly
    lexicalParent.append(node)
  }
}
