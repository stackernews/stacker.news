import { $generateHtmlFromNodes } from '@lexical/html'
import { sanitizeHTML } from '@/lib/dompurify'
import { withDOM } from '@/lib/lexical/server/dom'
import { createSNHeadlessEditor } from '@/lib/lexical/headless'
import { normalizeLexicalHTML } from '@/lib/lexical/server/normalize-html'

export function generateHTML (editor, selection = null, sanitize = true, window = global.window) {
  let html = ''
  try {
    html = editor.read(() => $generateHtmlFromNodes(editor, selection))
    html = normalizeLexicalHTML(html, window)
    if (sanitize) {
      html = sanitizeHTML(html, window)
    }
  } catch (error) {
    console.error('error generating HTML:', error)
    return 'Error generating HTML, content will be loaded in a moment.'
  }
  return html
}

/**
 * generates HTML from Lexical state on server-side
 *
 * note: gets called by APIs to submit items, check performance
 * @param {string} lexicalState - serialized lexical editor state
 * @param {Object} [options={}] - generation options
 * @param {boolean} [options.sanitize=true] - whether to sanitize HTML
 * @param {Object} [options.selection=null] - optional selection for partial HTML generation
 * @param {Object} [editorOptions={}] - editor configuration options
 * @returns {string} generated HTML or error message
 */
export function lexicalHTMLGenerator (lexicalState, options = {}, editorOptions = {}) {
  if (typeof window !== 'undefined') {
    throw new Error('can\'t use lexicalHTMLGenerator in a client environment as it creates a DOM and sets global window and document')
  }

  const {
    sanitize = true,
    selection = null
  } = options

  return withDOM(() => {
    const editor = createSNHeadlessEditor(editorOptions)

    try {
      editor.setEditorState(editor.parseEditorState(lexicalState))
    } catch (error) {
      return 'Error generating rich content, another attempt will be made. Mention an admin if this persists.'
    }

    return generateHTML(editor, selection, sanitize)
  })
}
