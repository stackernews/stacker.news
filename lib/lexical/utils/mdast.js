import { $getRoot } from 'lexical'
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm'
import { mathFromMarkdown, mathToMarkdown } from 'mdast-util-math'
import { gfm } from 'micromark-extension-gfm'
import { math } from 'micromark-extension-math'
import {
  importMarkdownToLexical,
  exportMarkdownFromLexical,
  importVisitors,
  exportVisitors
} from '@/lib/lexical/mdast'
import {
  mentionTransform,
  nostrTransform,
  misleadingLinkTransform,
  malformedLinkEncodingTransform,
  footnoteTransform,
  tocTransform
} from '@/lib/lexical/mdast/transforms'

export function markdownToLexical (editor, markdown) {
  editor.update(() => {
    const root = $getRoot()
    root.clear()

    // exit if markdown is empty
    if (markdown.trim() === '') return

    importMarkdownToLexical({
      root,
      markdown: removeZeroWidthSpace(markdown),
      visitors: importVisitors,
      syntaxExtensions: [
        gfm(),
        math({ singleDollarTextMath: false })
      ],
      mdastExtensions: [
        gfmFromMarkdown(),
        mathFromMarkdown()
      ],
      mdastTransforms: [
        mentionTransform,
        nostrTransform,
        misleadingLinkTransform,
        malformedLinkEncodingTransform,
        footnoteTransform,
        tocTransform
      ]
    })
  })
}

export const customToMarkdownExtensions = {
  handlers: Object.fromEntries(
    exportVisitors
      .filter(v => v.toMarkdown && v.mdastType)
      .map(v => [v.mdastType, v.toMarkdown])
  )
}

export function lexicalToMarkdown (root) {
  const markdown = exportMarkdownFromLexical({
    root,
    visitors: exportVisitors,
    toMarkdownExtensions: [
      gfmToMarkdown(),
      mathToMarkdown({ singleDollarTextMath: false }),
      customToMarkdownExtensions
    ],
    toMarkdownOptions: {
      join: [
        // separate consecutive paragraphs with a single newline
        // overrides default behavior of inserting a blank line between paragraphs
        // note: re-review on rich text support
        (left, right) => {
          if (left.type === 'paragraph' && right.type === 'paragraph') {
            return 0
          }
        }
      ],
      handlers: {
        // bypass default escaping - we want raw text for editor round-trips
        text: (node) => node.value
      }
    }
  })
  // NOTE: this might not cover edge cases
  // review when we add rich text support
  return removeZeroWidthSpace(markdown)
}

/** some browsers insert zero-width spaces (U+200B) */
export function removeZeroWidthSpace (text) {
  return text.replace(/\u200b/g, '')
}
