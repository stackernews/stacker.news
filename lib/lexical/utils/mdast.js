import { $getRoot, $getEditor } from 'lexical'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfmFootnoteToMarkdown } from 'mdast-util-gfm-footnote'
import { gfmStrikethroughToMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmTableToMarkdown } from 'mdast-util-gfm-table'
import { gfmTaskListItemToMarkdown } from 'mdast-util-gfm-task-list-item'
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

export function $markdownToLexical (markdown, { splitInParagraphs = false, append = false } = {}) {
  const root = $getRoot()
  if (!append) {
    root.clear()
  }

  const editor = $getEditor()
  const editable = editor.isEditable()

  // exit if markdown is empty
  if (markdown.trim() === '') return

  importMarkdownToLexical({
    splitInParagraphs,
    root,
    editable,
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

  root.selectEnd()
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

/** toMarkdown escape configuration, handles whitespace */
function escapeConfig (node, _parent, state, info) {
  // state.safe() escapes (what can be) markdown syntax
  // and encodes trailing/leading spaces as &#x20; to prevent accidental hard breaks.
  // we don't need this when converting lexical to markdown
  return state.safe(node.value, info).replace(/&#x20;/g, ' ')
}

export function $lexicalToMarkdown (transformerBridge = false) {
  const markdown = exportMarkdownFromLexical({
    root: $getRoot(),
    visitors: exportVisitors,
    toMarkdownExtensions: [
      {
        extensions: [
          gfmFootnoteToMarkdown(),
          gfmStrikethroughToMarkdown(),
          gfmTableToMarkdown(),
          gfmTaskListItemToMarkdown()
        ]
      },
      mathToMarkdown({ singleDollarTextMath: false }),
      customToMarkdownExtensions
    ],
    toMarkdownOptions: {
      join: [
        (left, right, state) => {
          if (left.type === 'paragraph' && right.type === 'paragraph') {
            if (left.blankLineAfter) {
              return 1
            }
            if (state?.type !== 'root') return 0
          }
        }
      ],
      handlers: {
        // when using the transformer bridge, bypass default escaping as we want raw text for editor round-trips
        // otherwise, escape what could be markdown syntax
        text: transformerBridge
          ? (node) => node.value
          : escapeConfig,
        image: (node) => {
          const alt = node.alt || ''
          const title = node.title ? ` "${node.title}"` : ''
          return `![${alt}](${node.url || ''}${title})`
        },
        // prevent autolink syntax (<url>), always use [text](url)
        link: (node, _parent, state) => {
          const text = state.containerPhrasing(node, { before: '[', after: ']' })
          // gfm-footnote extension marks [ as unsafe in phrasing,
          // but [ can't start footnotes or nested links inside link text, so the escape is unnecessary
          return `[${text.replace(/\\\[/g, '[')}](${node.url || ''}${node.title ? ` "${node.title}"` : ''})`
        }
      }
    }
  })
  // NOTE: this might not cover edge cases
  // review when we add rich text support
  return removeZeroWidthSpace(markdown)
}

export function lexicalToMarkdown (editor) {
  return editor.getEditorState().read(() => $lexicalToMarkdown())
}

/** some browsers insert zero-width spaces (U+200B) */
export function removeZeroWidthSpace (text) {
  return text.replace(/\u200b/g, '')
}
