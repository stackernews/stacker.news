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
import { mentionTransform } from '@/lib/lexical/mdast/transforms/mentions'

export function markdownToLexical (editor, markdown) {
  editor.update(() => {
    const root = $getRoot()
    root.clear()

    importMarkdownToLexical({
      root,
      markdown,
      visitors: importVisitors,
      syntaxExtensions: [
        gfm(),
        math()
      ],
      mdastExtensions: [
        gfmFromMarkdown(),
        mathFromMarkdown()
      ],
      mdastTransforms: [
        mentionTransform
      ]
    })
  })
}

export function lexicalToMarkdown (editor) {
  return editor.getEditorState().read(() => {
    return exportMarkdownFromLexical({
      root: $getRoot(),
      visitors: exportVisitors,
      toMarkdownExtensions: [
        gfmToMarkdown(),
        mathToMarkdown()
      ],
      toMarkdownOptions: {
        handlers: {
          // bypass default escaping - we want raw text for editor round-trips
          text: (node) => node.value
        }
      }
    })
  })
}
