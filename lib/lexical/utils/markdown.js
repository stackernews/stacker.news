import { createSNHeadlessEditor } from '@/lib/lexical/headless'
import { lexicalToMarkdown } from '@/lib/lexical/utils/mdast'

/**
 * converts lexical state to markdown using a headless editor
 * @param {string} lexicalState - serialized lexical editor state
 * @returns {string|null} markdown text, or null on error
 */
function prepareMarkdown (lexicalState) {
  if (!lexicalState) {
    throw new Error('lexicalState is required')
  }

  try {
    const editor = createSNHeadlessEditor()
    editor.setEditorState(lexicalState)
    return lexicalToMarkdown(editor)
  } catch (error) {
    console.error('error preparing markdown from lexical state: ', error)
    return null
  }
}

/**
 * if formik values contain a lexicalState (rich mode), converts it to markdown
 * and writes it into the given field, then deletes the lexicalState key.
 * no-op when lexicalState is absent (markdown mode already set the field).
 * mutates `values` in place.
 * @param {Object} [params.values] - values object
 * @param {string} [params.fieldName] - field name to write the markdown to
 */
export function resolveMarkdown (values, fieldName = 'text') {
  if (values.lexicalState) {
    values[fieldName] = prepareMarkdown(values.lexicalState)
    if (!values[fieldName]) {
      throw new Error('error preparing markdown')
    }
    delete values.lexicalState
  }
}
