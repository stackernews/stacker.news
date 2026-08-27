import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import { isMisleadingLink } from '@/lib/url'
import { isImageOnlyLink } from '@/lib/lexical/mdast/shared'

/**
 * a link is misleading if the text is not the same as the URL.
 *
 * this transform replaces the link text with the URL if it is misleading.
 * if the link wraps only an image, the link is removed but the image is kept.
 */
export function misleadingLinkTransform (tree) {
  visit(tree, 'link', (node, index, parent) => {
    // if the link has only an image child, unwrap it (remove the link but keep the image)
    if (isImageOnlyLink(node) && parent && index !== undefined) {
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

const MAILTO = 'mailto:'

// a fediverse or lemmy handle looks like @nym@instance.tld or !group@instance.tld.
// GFM's email autolink literal has no "character before" guard -- micromark starts
// it at the atext and never looks back -- so it links the nym@instance.tld part and
// leaves the sigil stranded as text. an address preceded by one of these is a
// handle, not an address anyone can mail.
const HANDLE_SIGILS = ['@', '!']

/**
 * undo the mailto: link GFM builds inside a fediverse handle.
 *
 * `@nym@instance.tld` parses as a text node holding `@` followed by an email
 * autolink. this folds the link back into that text node so the whole handle
 * renders as plain text.
 *
 * only bare autolinks are touched: an explicit [text](mailto:...) keeps its link,
 * and so does a normal address that nothing precedes.
 */
export function fediverseHandleTransform (tree) {
  visit(tree, 'link', (node, index, parent) => {
    if (!parent || !index) return // index 0 has no preceding text to carry a sigil
    if (!node.url?.toLowerCase().startsWith(MAILTO)) return

    // bare autolink only: its text is exactly the address it links to
    const text = toString(node)
    if (text !== node.url.slice(MAILTO.length)) return

    const previous = parent.children[index - 1]
    if (previous?.type !== 'text') return
    if (!HANDLE_SIGILS.includes(previous.value.slice(-1))) return

    parent.children.splice(index - 1, 2, { type: 'text', value: previous.value + text })
    return index - 1 // continue at the merged text node
  })
}
