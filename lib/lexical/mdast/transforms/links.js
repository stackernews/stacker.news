import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import { isMisleadingLink } from '@/lib/url'

const FEDIVERSE_HANDLE_MARKERS = new Set(['@', '!'])

function mailtoLinkText (node) {
  if (!node.url?.toLowerCase().startsWith('mailto:')) return

  return node.url.slice('mailto:'.length)
}

/**
 * gfm autolinks turn @user@host.tld into a text "@" and a mailto:user@host.tld link.
 * keep fediverse handles as plain text while preserving normal email autolinks.
 */
export function fediverseHandleTransform (tree) {
  visit(tree, 'link', (node, index, parent) => {
    if (!parent || index === undefined || index === 0) return

    const previous = parent.children[index - 1]
    if (previous?.type !== 'text') return

    const marker = previous.value?.slice(-1)
    if (!FEDIVERSE_HANDLE_MARKERS.has(marker)) return

    const text = toString(node)
    const mailtoText = mailtoLinkText(node)
    if (!text || text !== mailtoText) return

    const handleNode = { type: 'text', value: `${marker}${text}` }
    if (previous.value.length === 1) {
      parent.children.splice(index - 1, 2, handleNode)
      return index - 1
    }

    previous.value = previous.value.slice(0, -1)
    parent.children[index] = handleNode
    return index
  })
}

/**
 * a link is misleading if the text is not the same as the URL.
 *
 * this transform replaces the link text with the URL if it is misleading.
 * if the link wraps only an image, the link is removed but the image is kept.
 */
export function misleadingLinkTransform (tree) {
  visit(tree, 'link', (node, index, parent) => {
    // if the link has only an image child, unwrap it (remove the link but keep the image)
    const hasOnlyImage = node.children?.length === 1 && node.children[0].type === 'image'
    if (hasOnlyImage && parent && index !== undefined) {
      parent.children[index] = node.children[0]
      return index
    }

    const text = toString(node)
    if (!text) return
    if (!node.url) return

    if (isMisleadingLink(text, node.url)) {
      node.children = [{ type: 'text', value: node.url }]
    }
  })
}

/** LinkeDOM patch: decodeURI(url) fails on malformed URLs,
 * so we replace the link node with a text node */
export function malformedLinkEncodingTransform (tree) {
  visit(tree, 'link', (node, index, parent) => {
    if (!node.url) return

    try {
      decodeURI(node.url)
    } catch {
      if (parent && index !== undefined) {
        parent.children[index] = { type: 'text', value: node.url }
      } else {
        // note: we should never reach this case, if we do we probably have a RootNode as parent,
        // this might cause double encoding
        node.url = encodeURI(node.url)
      }
    }
  })
}
