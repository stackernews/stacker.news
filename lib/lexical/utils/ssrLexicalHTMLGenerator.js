// TODO: cleanup, better name I suppose?
import { createHeadlessEditor } from '@lexical/headless'
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'
import { sanitizeHTML, createJSDOM } from '../../dompurify'
import snTheme from '@/components/lexical/styles/theme'
import defaultNodes from '../nodes'

// creates a headless editor with SN default options
function createSNHeadlessEditor (options) {
  // default values
  const {
    namespace = 'snSSR',
    nodes = defaultNodes,
    theme = snTheme,
    onError = (error) => {
      console.error(error)
    }
  } = options

  return createHeadlessEditor({
    namespace,
    nodes,
    theme,
    onError
  })
}

// SN SSR HTML generator for Lexical that supports custom options
// creates a fake global DOM
// can pass a selection to generate a specific part of the lexical state
// returns the generated HTML
export function ssrLexicalHTMLGenerator (lexicalState, options = {}, editorOptions = {}) {
  if (typeof window !== 'undefined') {
    throw new Error('can\'t use ssrLexicalHTMLGenerator in a client environment as it creates a DOM and sets global window and document')
  }

  const {
    sanitize = true,
    selection = null
  } = options

  let html = ''

  try {
    // headless editor supporting custom options
    const editor = createSNHeadlessEditor(editorOptions)

    // JS DOM setup
    const dom = createJSDOM()
    global.window = dom.window
    global.document = dom.document

    // set the editor state
    const editorState = editor.parseEditorState(lexicalState)
    editor.setEditorState(editorState)
    editor.getEditorState().read(() => {
      html = $generateHtmlFromNodes(editor, selection)
    })

    if (sanitize) {
      html = sanitizeHTML(html, dom)
    }

    // cleanup
    global.window = null
    global.document = null

    return html
  } catch (error) {
    // cleanup
    global.window = null
    global.document = null

    console.error('error generating HTML in SSR from Lexical State: ', error)
    return ''
  }
}

// returns lexical nodes from HTML
export function ssrLexicalHTMLImporter (html, editorOptions = {}) {
  if (typeof window !== 'undefined') {
    throw new Error('can\'t use ssrLexicalHTMLImporter in a client environment')
  }

  // headless editor supporting custom options
  const editor = createSNHeadlessEditor(editorOptions)

  // JS DOM setup
  const dom = createJSDOM(html)

  // generate nodes from DOM
  return $generateNodesFromDOM(editor, dom)
}
