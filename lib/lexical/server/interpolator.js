import { $createSNHeadlessEditor } from '@/lib/lexical/server/headless'
import { $ssrCheckMediaNodes } from '@/lib/lexical/server/media/check'
import { $trimEmptyNodes } from '@/lib/lexical/utils'
import { setMarkdown } from '@/lib/lexical/utils/mdast'

/**
 * converts markdown to Lexical state or processes existing state
 * @param {string} [params.text] - markdown text to convert
 * @param {Object} [options={}] - processing options
 * @param {boolean} [options.checkMedia=true] - whether to check media URLs
 * @returns {Promise<Object>} object with text and lexicalState properties
 */
export async function prepareLexicalState ({ text }, { checkMedia = true } = {}) {
  if (typeof window !== 'undefined') {
    throw new Error('can\'t use prepareLexicalState in a client environment')
  }
  if (!text) {
    throw new Error('text is required')
  }

  const editor = $createSNHeadlessEditor()

  let hasError = false

  // transform the markdown text into a lexical state via MDAST
  editor.update(() => {
    setMarkdown(editor, text)
    $trimEmptyNodes()
  })

  // get all the media nodes that are of unknown type, and check their type
  // via capture-media-check
  if (checkMedia) {
    try {
      await $ssrCheckMediaNodes(editor)
    } catch (error) {
      console.error('error checking media nodes: ', error)
      // move on, media check nodes are not critical to the content
    }
  }

  let lexicalState = {}
  editor.read(() => {
    try {
      lexicalState = editor.getEditorState().toJSON()
      console.log('lexicalState: ', JSON.stringify(lexicalState, null, 2))
    } catch (error) {
      console.error('error generating Lexical JSON State: ', error)
      hasError = true
    }
  })

  if (hasError) return null

  // prepared text and lexical state
  return lexicalState
}
