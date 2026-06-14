import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import { isMisleadingLink } from '@/lib/url'

function isLiteralMailtoAutolink (node) {
  if (!node.url?.startsWith('mailto:')) return false
  if (node.children?.length !== 1 || node.children[0].type !== 'text') return false
  if (node.url !== `mailto:${toString(node)}`) return false

  const child = node.children[0]
  return child.position?.start?.offset === node.position?.start?.offset &&
    child.position?.end?.offset === node.position?.end?.offset
}

function hasAdjacentFediversePrefix (node, index, parent) {
  const previous = parent?.children?.[index - 1]
  if (previous?.type !== 'text') return false
  if (!previous.value.endsWith('@') && !previous.value.endsWith('!')) return false

  return previous.position?.end?.offset === node.position?.start?.offset
}

export function fediverseHandleTransform (tree) {
  visit(tree, 'link', (node, index, parent) => {
    if (index === undefined) return
    if (!isLiteralMailtoAutolink(node)) return
    if (!hasAdjacentFediversePrefix(node, index, parent)) return

    parent.children[index] = {
      type: 'text',
      value: toString(node),
      position: node.position
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
