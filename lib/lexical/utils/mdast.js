import { $getRoot } from 'lexical'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { mathFromMarkdown } from 'mdast-util-math'
import { gfmFootnoteFromMarkdown } from 'mdast-util-gfm-footnote'
import { gfm } from 'micromark-extension-gfm'
import { gfmFootnote } from 'micromark-extension-gfm-footnote'
import { math } from 'micromark-extension-math'
import {
  importMarkdownToLexical,
  exportMarkdownFromLexical,
  importVisitors,
  exportVisitors,
  createMentionTransform
} from '@/lib/lexical-markdown'

const mentionTransform = createMentionTransform()

export function setMarkdown (editor, markdown) {
  editor.update(() => {
    const root = $getRoot()
    root.clear()

    importMarkdownToLexical({
      root,
      markdown,
      visitors: importVisitors,
      syntaxExtensions: [
        gfm(),
        math(),
        gfmFootnote()
      ],
      mdastExtensions: [
        gfmFromMarkdown(),
        mathFromMarkdown(),
        gfmFootnoteFromMarkdown()
      ],
      mdastTransforms: [
        mentionTransform
      ]
    })
  })
}

export function getMarkdown (editor) {
  return editor.getEditorState().read(() => {
    return exportMarkdownFromLexical({
      root: $getRoot(),
      visitors: exportVisitors,
      toMarkdownExtensions: [],
      toMarkdownOptions: {}
    })
  })
}
