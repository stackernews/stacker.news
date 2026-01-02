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

export function lexicalToMarkdown (editor) {
  return editor.getEditorState().read(() => {
    const markdown = exportMarkdownFromLexical({
      root: $getRoot(),
      visitors: exportVisitors,
      toMarkdownExtensions: [
        gfmToMarkdown(),
        mathToMarkdown({ singleDollarTextMath: false }),
        customToMarkdownExtensions
      ],
      toMarkdownOptions: {
        handlers: {
          // bypass default escaping - we want raw text for editor round-trips
          text: (node) => node.value
        }
      }
    })
    // NOTE: this might not cover edge cases
    // review when we add rich text support
    return removeZeroWidthSpace(markdown)
  })
}

/** some browsers insert zero-width spaces (U+200B) */
export function removeZeroWidthSpace (text) {
  return text.replace(/\u200b/g, '')
}
