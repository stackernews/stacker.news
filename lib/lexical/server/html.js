import { $generateHtmlFromNodes } from '@lexical/html'
import { sanitizeHTML } from '@/lib/dompurify'
import { withDOM, createSNHeadlessEditor } from '@/lib/lexical/server/headless'

/**
 * generates HTML from Lexical state on server-side
 *
 * note: gets called by APIs to submit items, check performance
 * @param {string} lexicalState - serialized lexical editor state
 * @param {number} [itemId=null] - optional item ID for error logging
 * @param {Object} [options={}] - generation options
 * @param {boolean} [options.sanitize=true] - whether to sanitize HTML
 * @param {Object} [options.selection=null] - optional selection for partial HTML generation
 * @param {Object} [editorOptions={}] - editor configuration options
 * @returns {string} generated HTML or error message
 */
export function lexicalHTMLGenerator (lexicalState, options = {}, editorOptions = {}) {
  if (typeof window !== 'undefined') {
    throw new Error('can\'t use $ssrLexicalHTMLGenerator in a client environment as it creates a DOM and sets global window and document')
  }

  const {
    sanitize = true,
    selection = null
  } = options

  return withDOM(window => {
    const editor = createSNHeadlessEditor(editorOptions)

    try {
      editor.setEditorState(editor.parseEditorState(lexicalState))
    } catch (error) {
      return 'error generating HTML, another attempt will be made. the text will be hydrated in a moment.'
    }
    let html = ''

    editor.update(() => {
      try {
        html = $generateHtmlFromNodes(editor, selection)
        if (sanitize) {
          html = sanitizeHTML(html, window)
        }
      } catch (error) {
        // if the html conversion fails, we'll use the lexicalState directly
        // this might be a problem for instant content
        console.error('error generating HTML in SSR from Lexical State: ', error)
        html = null
      }
    })

    return html
  })
}
