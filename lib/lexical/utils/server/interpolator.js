import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { $createSNHeadlessEditor } from '@/lib/lexical/utils/server/headless'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $ssrCheckMediaNodes } from '@/lib/lexical/utils/server/media/check'
import { $isMarkdownMode, $trimEmptyNodes } from '@/lib/lexical/universal/utils'
import { $getRoot } from 'lexical'

/**
 * converts markdown to Lexical state or processes existing state
 * @param {string} [params.text] - markdown text to convert
 * @param {string} [params.lexicalState] - existing lexical state to process
 * @param {Object} [options={}] - processing options
 * @param {boolean} [options.checkMedia=true] - whether to check media URLs
 * @returns {Promise<Object>} object with text and lexicalState properties
 */
export async function prepareLexicalState ({ text, lexicalState }, { checkMedia = true } = {}) {
  // console.log('prepareLexicalState', text, lexicalState, checkMedia)
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
      $trimEmptyNodes()
      try {
        const isMarkdownMode = $isMarkdownMode()
        if (isMarkdownMode) {
          text = $getRoot().getFirstChild()?.getTextContent() || ''
          $convertFromMarkdownString(text, SN_TRANSFORMERS, undefined, false)
        } else {
          text = $convertToMarkdownString(SN_TRANSFORMERS, undefined, false)
        }
        $trimEmptyNodes()
      } catch (error) {
        console.error('error generating lexical state: ', error)
        return null
      }
    })
  } else if (text) {
    // transform the markdown text into a lexical state
    editor.update(() => {
      $convertFromMarkdownString(text, SN_TRANSFORMERS, undefined, false, false)
      $trimEmptyNodes()
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
