import { isMisleadingLink } from '@/lib/url'

function visitLinks (node, visitor) {
  if (!node?.children) return

  for (let index = 0; index < node.children.length; index++) {
    const child = node.children[index]
    if (child.type === 'link') {
      visitor(child, index, node)
    }

    visitLinks(node.children[index], visitor)
  }
}

function nodeToString (node) {
  if (typeof node?.value === 'string') return node.value
  if (typeof node?.alt === 'string') return node.alt
  if (!node?.children) return ''

  return node.children.map(nodeToString).join('')
}

/**
 * a link is misleading if the text is not the same as the URL.
 *
 * this transform replaces the link text with the URL if it is misleading.
 * if the link wraps only an image, the link is removed but the image is kept.
 */
export function misleadingLinkTransform (tree) {
  visitLinks(tree, (node, index, parent) => {
    // if the link has only an image child, unwrap it (remove the link but keep the image)
    const hasOnlyImage = node.children?.length === 1 && node.children[0].type === 'image'
    if (hasOnlyImage && parent && index !== undefined) {
      parent.children[index] = node.children[0]
      return
    }

    const text = nodeToString(node)
    if (!text) return
    if (!node.url) return

    if (isMisleadingLink(text, node.url)) {
      node.children = [{ type: 'text', value: node.url }]
    }
  })
}

export function trailingUnderscoreAutolinkTransform (tree) {
  visitLinks(tree, (node, index, parent) => {
    if (!parent || index === undefined) return
    if (!node.url) return
    if (nodeToString(node) !== node.url) return

    const next = parent.children[index + 1]
    if (next?.type !== 'text') return

    const trailingUnderscores = next.value.match(/^_+/)?.[0]
    if (!trailingUnderscores) return

    node.url += trailingUnderscores
    if (node.children.length === 1 && node.children[0].type === 'text') {
      node.children[0].value += trailingUnderscores
    } else {
      node.children = [{ type: 'text', value: node.url }]
    }

    if (next.value === trailingUnderscores) {
      parent.children.splice(index + 1, 1)
    } else {
      next.value = next.value.slice(trailingUnderscores.length)
    }
  })
}

/** LinkeDOM patch: decodeURI(url) fails on malformed URLs,
 * so we replace the link node with a text node */
export function malformedLinkEncodingTransform (tree) {
  visitLinks(tree, (node, index, parent) => {
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
