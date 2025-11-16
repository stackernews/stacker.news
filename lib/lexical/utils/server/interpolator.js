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
  if (typeof window !== 'undefined') {
    throw new Error('can\'t use prepareLexicalState in a client environment')
  }
  if (!text && !lexicalState) {
    throw new Error('text or lexicalState is required')
  }

  const editor = $createSNHeadlessEditor()

  let processedText = text
  let processedLexicalState = lexicalState
  let hasError = false

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
          processedText = $getRoot().getFirstChild()?.getTextContent() || ''
          $convertFromMarkdownString(processedText, SN_TRANSFORMERS, undefined, false)
        } else {
          processedText = $convertToMarkdownString(SN_TRANSFORMERS, undefined, false)
        }
        $trimEmptyNodes()
      } catch (error) {
        console.error('error generating lexical state: ', error)
        hasError = true
      }
    })

    if (hasError) return null
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
    try {
      await $ssrCheckMediaNodes(editor)
    } catch (error) {
      console.error('error checking media nodes: ', error)
      // move on, media check nodes are not critical to the content
    }
  }

  editor.read(() => {
    try {
      processedLexicalState = JSON.stringify(editor.getEditorState().toJSON())
    } catch (error) {
      console.error('error generating Lexical JSON State: ', error)
      hasError = true
    }
  })

  if (hasError) return null

  // prepared text and lexical state
  return { text: processedText, lexicalState: processedLexicalState }
}
