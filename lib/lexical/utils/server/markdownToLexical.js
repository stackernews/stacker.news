import { $convertFromMarkdownString } from '@lexical/markdown'
import { $createSNHeadlessEditor } from '@/lib/lexical/utils/server/headless'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $ssrCheckMediaNodes } from '@/lib/lexical/utils/server/media/check'

export async function $ssrMarkdownToLexicalConverter (markdown) {
  if (typeof window !== 'undefined') {
    throw new Error('can\'t use $ssrMarkdownToLexicalConverter in a client environment')
  }

  const editor = $createSNHeadlessEditor()

  let lexicalState = null
  editor.update(() => {
    try {
      $convertFromMarkdownString(markdown, SN_TRANSFORMERS)
    } catch (error) {
      console.error('error generating Lexical JSON State from Markdown: ', error)
      return null
    }
  })

  // get all the media nodes that are of unknown type, and check their type
  // via capture-media-check
  await $ssrCheckMediaNodes(editor)

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
