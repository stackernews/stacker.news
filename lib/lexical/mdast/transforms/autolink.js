import { visit } from 'unist-util-visit'

/**
 * GFM autolink treats underscores as trailing punctuation, stripping them
 * from the end of bare URLs.  For example, `https://x.com/some_user_`
 * becomes a link to `https://x.com/some_user` followed by a plain-text `_`.
 *
 * This transform detects that pattern and merges the stripped underscores
 * back into the link so the URL renders correctly.
 *
 * Only bare autolinks (link text === URL) are affected; explicit markdown
 * links like `[text](url)` already preserve the full URL.
 *
 * Fixes https://github.com/stackernews/stacker.news/issues/180
 */
export function trailingUnderscoreAutolinkTransform (tree) {
  visit(tree, 'link', (node, index, parent) => {
    if (parent == null || index == null) return

    // only fix bare autolinks where the visible text matches the URL
    const textChild = node.children?.[0]
    if (!textChild || textChild.type !== 'text') return
    if (textChild.value !== node.url) return

    // check if the next sibling is a text node starting with underscore(s)
    const next = parent.children[index + 1]
    if (!next || next.type !== 'text') return

    const match = next.value.match(/^_+/)
    if (!match) return

    const underscores = match[0]

    // merge the underscores back into the link
    node.url += underscores
    textChild.value += underscores

    // consume the underscores from the sibling text node
    if (next.value.length === underscores.length) {
      parent.children.splice(index + 1, 1)
    } else {
      next.value = next.value.slice(underscores.length)
    }
  })
}
