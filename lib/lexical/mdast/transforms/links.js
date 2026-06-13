import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import { isMisleadingLink } from '@/lib/url'

const FEDIVERSE_HANDLE_PREFIX = /[@!]$/

function isAutolinkedEmail (node) {
  if (node?.type !== 'link') return false
  if (!node.url?.startsWith('mailto:')) return false
  if (node.title) return false

  const text = toString(node)
  if (!text) return false

  const startOffset = node.position?.start?.offset
  const endOffset = node.position?.end?.offset
  if (Number.isInteger(startOffset) && Number.isInteger(endOffset) && endOffset - startOffset !== text.length) {
    return false
  }

  return node.url === `mailto:${text}`
}

export function fediverseHandleTransform (tree) {
  visit(tree, (node) => {
    if (!Array.isArray(node.children)) return

    for (let i = 1; i < node.children.length; i++) {
      const prev = node.children[i - 1]
      const child = node.children[i]
      if (prev?.type !== 'text') continue
      if (!FEDIVERSE_HANDLE_PREFIX.test(prev.value ?? '')) continue
      if (!isAutolinkedEmail(child)) continue

      node.children[i] = { type: 'text', value: toString(child) }
    }
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
