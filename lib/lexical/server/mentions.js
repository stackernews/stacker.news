import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { mathFromMarkdown } from 'mdast-util-math'
import { gfm } from 'micromark-extension-gfm'
import { math } from 'micromark-extension-math'
import { visit } from 'unist-util-visit'
import { mentionTransform, itemMentionTransform } from '@/lib/lexical/mdast/transforms/mentions'

// extract user and item mentions from an item's markdown
export function extractMentions (text) {
  // no text, or no clear signs of mentions, so nothing to extract
  if (!text?.trim() || (!text.includes('@') && !text.includes('/items/'))) {
    return { userNames: [], itemIds: [] }
  }

  let tree
  try {
    tree = fromMarkdown(text, {
      extensions: [gfm(), math({ singleDollarTextMath: false })],
      mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()]
    })
  } catch {
    // never let malformed markdown block item creation/notifications
    return { userNames: [], itemIds: [] }
  }

  mentionTransform(tree)
  itemMentionTransform(tree)

  const userNames = new Set()
  const itemIds = new Set()

  visit(tree, ['userMention', 'itemMention'], (node) => {
    if (node.type === 'userMention') {
      userNames.add(node.value.name)
    } else {
      const id = Number(node.value.id)
      if (!Number.isNaN(id)) itemIds.add(id)
    }
  })

  return { userNames: [...userNames], itemIds: [...itemIds] }
}
