import createSNHeadlessEditor from '@/lib/lexical/utils/headlessEditor'
import { $convertFromMarkdownString } from '@lexical/markdown'
import { SN_TRANSFORMERS, BARE_LINK } from '@/lib/lexical/transformers/image-markdown-transformer'

export function ssrMarkdownToLexicalConverter (markdown) {
  if (typeof window !== 'undefined') {
    throw new Error('can\'t use ssrLexicalMarkdownGenerator in a client environment')
  }

  const editor = createSNHeadlessEditor()

  const moreTransformers = [...SN_TRANSFORMERS, BARE_LINK]

  let lexicalState = null
  editor.update(() => {
    try {
      console.log('converting markdown to lexical state')
      $convertFromMarkdownString(markdown, moreTransformers)
    } catch (error) {
      console.error('error generating Lexical JSON State from Markdown: ', error)
      return null
    }
  })

  editor.read(() => {
    try {
      lexicalState = JSON.stringify(editor.getEditorState().toJSON())
    } catch (error) {
      console.error('error generating Lexical JSON State from Markdown: ', error)
      return null
    }
  })

  return lexicalState
}
