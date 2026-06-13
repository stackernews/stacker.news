import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import { isMisleadingLink } from '@/lib/url'

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

export function trailingUnderscoreAutolinkTransform (tree) {
  visit(tree, 'link', (node, index, parent) => {
    if (!parent || index === undefined) return
    if (!node.url) return
    if (toString(node) !== node.url) return

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
