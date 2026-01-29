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

export function $markdownToLexical (markdown, splitInParagraphs = false) {
  const root = $getRoot()
  root.clear()

  // exit if markdown is empty
  if (markdown.trim() === '') return

  importMarkdownToLexical({
    splitInParagraphs,
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
}

export function markdownToLexical (editor, markdown) {
  editor.update(() => {
    $markdownToLexical(markdown)
  })
}

export const customToMarkdownExtensions = {
  handlers: Object.fromEntries(
    exportVisitors
      .filter(v => v.toMarkdown && v.mdastType)
      .map(v => [v.mdastType, v.toMarkdown])
  )
}

export function $lexicalToMarkdown () {
  const markdown = exportMarkdownFromLexical({
    root: $getRoot(),
    visitors: exportVisitors,
    toMarkdownExtensions: [
      gfmToMarkdown(),
      mathToMarkdown({ singleDollarTextMath: false }),
      customToMarkdownExtensions
    ],
    toMarkdownOptions: {
      join: [
        // join paragraphs with single newline, unless blank line is needed
        (left, right) => {
          if (left.type === 'paragraph' && right.type === 'paragraph') {
            // check if the left paragraph needs a blank line after it (empty paragraph marker)
            if (left.blankLineAfter) {
              return 1 // 2 newlines (blank line) to preserve empty paragraphs
            }
            return 0 // 1 newline between paragraphs
          }
        }
      ],
      handlers: {
        // bypass default escaping - we want raw text for editor round-trips
        text: (node) => node.value,
        url: (url) => url,
        // prevent autolink syntax (<url>), always use [text](url)
        link: (node, _parent, state) => {
          const text = state.containerPhrasing(node, { before: '[', after: ']' })
          return `[${text}](${node.url}${node.title ? ` "${node.title}"` : ''})`
        }
      }
    }
  })
  // NOTE: this might not cover edge cases
  // review when we add rich text support
  return removeZeroWidthSpace(markdown)
}

export function lexicalToMarkdown (editor) {
  return editor.getEditorState().read(() => {
    return $lexicalToMarkdown()
  })
}

/** some browsers insert zero-width spaces (U+200B) */
export function removeZeroWidthSpace (text) {
  return text.replace(/\u200b/g, '')
}
