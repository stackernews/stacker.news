import { $generateHtmlFromNodes } from '@lexical/html'
import { sanitizeHTML } from '@/lib/dompurify'
import { withDOM, $createSNHeadlessEditor } from '@/lib/lexical/utils/server/headless'

// SN SSR HTML generator for Lexical that supports custom options
// creates a fake global DOM
// can pass a selection to generate a specific part of the lexical state
// returns the generated HTML
export function $ssrLexicalHTMLGenerator (lexicalState, options = {}, editorOptions = {}) {
  if (typeof window !== 'undefined') {
    throw new Error('can\'t use $ssrLexicalHTMLGenerator in a client environment as it creates a DOM and sets global window and document')
  }

  const {
    sanitize = true,
    selection = null
  } = options

  return withDOM(window => {
    const editor = $createSNHeadlessEditor(editorOptions)

    try {
      editor.setEditorState(editor.parseEditorState(lexicalState))
    } catch (error) {
      console.error('error setting editor state: ', error)
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
        html = 'error generating HTML, another attempt will be made. the text will be hydrated in a moment.'
      }
    })

    return html
  })
}
