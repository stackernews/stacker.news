import { $createTextNode } from 'lexical'
import { $createLinkNode, $isLinkNode } from '@lexical/link'
import { $createItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item'
import { $createEmbedNode, $isEmbedNode } from '@/lib/lexical/nodes/content/embed'
import { $createMediaNode, $isMediaNode } from '@/lib/lexical/nodes/content/media'
import { parseInternalLinks, parseEmbedUrl, ensureProtocol } from '@/lib/url'
import { $isGalleryNode } from '@/lib/lexical/nodes/content/gallery'

const PRIORITIES = {
  ITEM_MENTION: 20,
  EMBED: 15,
  MEDIA: 10
}

// check if link is a "bare link" (text matches url)
function isBareLink (mdastNode) {
  const linkText = mdastNode.children?.[0]?.value
  return linkText === mdastNode.url
}

// check if a bare link is standalone in its own paragraph
function isStandaloneBareLink (mdastNode, mdastParent) {
  if (!isBareLink(mdastNode)) return false
  // must be in a paragraph with no siblings
  return mdastParent?.type === 'paragraph' && mdastParent.children?.length === 1
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
  priority: PRIORITIES.ITEM_MENTION,
  visitNode ({ mdastNode, actions }) {
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
        actions.addAndStepInto(node)
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
  priority: PRIORITIES.EMBED,
  visitNode ({ mdastNode, mdastParent, actions }) {
    if (!isStandaloneBareLink(mdastNode, mdastParent)) {
      actions.nextVisitor()
      return
    }

    const embed = getEmbed(mdastNode.url)
    if (embed.provider) {
      const node = $createEmbedNode({ provider: embed.provider, src: embed.src, id: embed.id, meta: embed.meta })
      actions.addAndStepInto(node)
      return
    }

    actions.nextVisitor()
  }
}

// bare link -> media (medium priority)
// fallback for other bare links - treated as media
export const MdastMediaFromLinkVisitor = {
  testNode: 'link',
  priority: PRIORITIES.MEDIA,
  visitNode ({ mdastNode, mdastParent, actions }) {
    if (!isStandaloneBareLink(mdastNode, mdastParent)) {
      actions.nextVisitor()
      return
    }
    const node = $createMediaNode({ src: mdastNode.url })
    actions.addAndStepInto(node)
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

// a GalleryNode is a wrapper for MediaNodes
// usually a MediaNode is wrapped in a ParagraphNode, but in this case it is not
// we need to extract MediaNodes, wrap them in a paragraph and add them to the mdast parent
export const LexicalGalleryVisitor = {
  testLexicalNode: $isGalleryNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    const children = lexicalNode.getChildren()
    children.forEach((child) => {
      if ($isMediaNode(child)) {
        const paragraph = { type: 'paragraph', children: [] }
        actions.appendToParent(mdastParent, paragraph)
        actions.visit(child, paragraph)
      }
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
      alt: lexicalNode.getAlt() || '',
      title: lexicalNode.getTitle() || ''
    })
  }
}

// mdast -> lexical: image
export const MdastImageVisitor = {
  testNode: 'image',
  visitNode ({ mdastNode, actions }) {
    const node = $createMediaNode({
      src: mdastNode.url,
      alt: mdastNode.alt || '',
      title: mdastNode.title || ''
    })
    actions.addAndStepInto(node)
  }
}
