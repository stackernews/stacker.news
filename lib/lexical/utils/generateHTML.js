import { createHeadlessEditor } from '@lexical/headless'
import { $generateHtmlFromNodes } from '@lexical/html'
import { sanitizeHTML } from '../../dompurify'
import defaultNodes from '../nodes'

// SN SSR HTML generator for Lexical
export function generateHTML (lexicalState, options = {}) {
  const {
    nodes = defaultNodes,
    theme = {},
    sanitize = true
  } = options

  const editor = createHeadlessEditor({
    namespace: 'snSSRgen',
    nodes,
    theme,
    onError: (error) => {
      console.error(error)
    }
  })

  let html = ''

  try {
    const editorState = editor.parseEditorState(lexicalState)
    editor.setEditorState(editorState)
    editor.getEditorState().read(() => {
      html = $generateHtmlFromNodes(editor, null)
    })

    if (sanitize) {
      html = sanitizeHTML(html)
    }

    return html
  } catch (error) {
    console.error('error generating HTML in SSR from Lexical State: ', error)
    return ''
  }
}
