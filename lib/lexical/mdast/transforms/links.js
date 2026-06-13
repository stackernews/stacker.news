import { isMisleadingLink } from '@/lib/url'

const FEDIVERSE_HANDLE_PREFIX = /[@!]$/

function nodeToString (node) {
  if (!node) return ''
  if (typeof node.value === 'string') return node.value
  if (typeof node.alt === 'string') return node.alt
  if (!Array.isArray(node.children)) return ''

  return node.children.map(nodeToString).join('')
}

function visitNodes (tree, test, visitor) {
  function matches (node) {
    if (typeof test === 'string') return node?.type === test
    if (typeof test === 'function') return test(node)
    return true
  }

  function visitNode (node, index, parent) {
    if (matches(node)) {
      visitor(node, index, parent)
    }

    if (!Array.isArray(node.children)) return

    for (let i = 0; i < node.children.length; i++) {
      visitNode(node.children[i], i, node)
    }
  }

  visitNode(tree)
}

function isAutolinkedEmail (node) {
  if (node?.type !== 'link') return false
  if (!node.url?.startsWith('mailto:')) return false
  if (node.title) return false

  const text = nodeToString(node)
  if (!text) return false

  const startOffset = node.position?.start?.offset
  const endOffset = node.position?.end?.offset
  if (Number.isInteger(startOffset) && Number.isInteger(endOffset) && endOffset - startOffset !== text.length) {
    return false
  }

  return node.url === `mailto:${text}`
}

export function fediverseHandleTransform (tree) {
  visitNodes(tree, (node) => {
    if (!Array.isArray(node.children)) return

    for (let i = 1; i < node.children.length; i++) {
      const prev = node.children[i - 1]
      const child = node.children[i]
      if (prev?.type !== 'text') continue
      if (!FEDIVERSE_HANDLE_PREFIX.test(prev.value ?? '')) continue
      if (!isAutolinkedEmail(child)) continue

      node.children[i] = { type: 'text', value: nodeToString(child) }
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
  visitNodes(tree, 'link', (node, index, parent) => {
    // if the link has only an image child, unwrap it (remove the link but keep the image)
    const hasOnlyImage = node.children?.length === 1 && node.children[0].type === 'image'
    if (hasOnlyImage && parent && index !== undefined) {
      parent.children[index] = node.children[0]
      return index
    }

    const text = nodeToString(node)
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
  visitNodes(tree, 'link', (node, index, parent) => {
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
