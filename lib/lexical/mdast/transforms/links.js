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

/**
 * GFM autolinks aggressively detect email addresses. This causes
 * Fediverse-style handles like @user@instance.org to be parsed as
 * mailto:user@instance.org with the leading @ left as plain text.
 *
 * This transform detects when a mailto autolink is immediately preceded
 * by @ or ! (Fediverse mention/group prefixes) and unwraps the link
 * back into plain text, merging it with the surrounding text nodes.
 *
 * Fixes https://github.com/stackernews/stacker.news/issues/93
 */
export function emailAutolinkTransform (tree) {
  visit(tree, 'link', (node, index, parent) => {
    if (!node.url?.startsWith('mailto:')) return
    if (!parent || index === undefined) return

    const prev = index > 0 ? parent.children[index - 1] : null
    if (!prev || prev.type !== 'text') return

    // if the preceding text ends with @ or !, this is a Fediverse-style
    // handle, not a real email address
    if (!prev.value.endsWith('@') && !prev.value.endsWith('!')) return

    // unwrap: replace the link node with its text content
    const linkText = toString(node)
    parent.children[index] = { type: 'text', value: linkText }

    // merge adjacent text nodes (prev + unwrapped link + next if also text)
    const merged = prev.value + linkText
    const next = parent.children[index + 1]
    if (next?.type === 'text') {
      parent.children.splice(index - 1, 3, { type: 'text', value: merged + next.value })
    } else {
      parent.children.splice(index - 1, 2, { type: 'text', value: merged })
    }

    // revisit from the merged node position
    return index - 1
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
