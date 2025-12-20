import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import { isMisleadingLink } from '@/lib/url'

/**
 * a link is misleading if the text is not the same as the URL.
 *
 * this transform replaces the link text with the URL if it is misleading.
 */
export function misleadingLinkTransform (tree) {
  visit(tree, 'link', (node) => {
    // if the link has an image, we don't want to replace the text with the URL
    const hasImage = node.children?.some(child => child.type === 'image')
    if (hasImage) return

    const text = toString(node)
    if (!text) return
    if (!node.url) return

    if (isMisleadingLink(text, node.url)) {
      node.children = [{ type: 'text', value: node.url }]
    }
  })
}
