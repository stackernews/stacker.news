import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { $createSNHeadlessEditor } from '@/lib/lexical/utils/server/headless'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $ssrCheckMediaNodes } from '@/lib/lexical/utils/server/media/check'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import { $getRoot } from 'lexical'

export async function prepareLexicalState ({ text, lexicalState }, { checkMedia = true } = {}) {
  console.log('prepareLexicalState', text, lexicalState, checkMedia)
  if (typeof window !== 'undefined') {
    throw new Error('can\'t use prepareLexicalState in a client environment')
  }

  const editor = $createSNHeadlessEditor()
  if (lexicalState) {
    // parse the provided lexical state
    try {
      editor.setEditorState(editor.parseEditorState(lexicalState))
    } catch (error) {
      console.error('error setting editor state: ', error)
      return null
    }
    // extract or transform the state into markdown
    editor.update(() => {
      try {
        const isMarkdownMode = $isMarkdownMode()
        if (isMarkdownMode) {
          text = $getRoot().getFirstChild()?.getTextContent() || ''
          $convertFromMarkdownString(text, SN_TRANSFORMERS, undefined, true)
        } else {
          text = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
        }
      } catch (error) {
        console.error('error generating lexical state: ', error)
        return null
      }
    })
  } else if (text) {
    // transform the markdown text into a lexical state
    editor.update(() => {
      $convertFromMarkdownString(text, SN_TRANSFORMERS, undefined, false, false)
    })
  }

  // get all the media nodes that are of unknown type, and check their type
  // via capture-media-check
  if (checkMedia) {
    await $ssrCheckMediaNodes(editor)
  }

  editor.read(() => {
    try {
      lexicalState = JSON.stringify(editor.getEditorState().toJSON())
    } catch (error) {
      console.error('error generating Lexical JSON State: ', error)
      return null
    }
  })

  // return the prepared text and lexical state
  return { text, lexicalState }
}
