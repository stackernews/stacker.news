// TODO: cleanup, better name I suppose?
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'
import { sanitizeHTML, createLinkeDOM } from '@/lib/dompurify'
import createSNHeadlessEditor from '@/lib/lexical/utils/server/headless'

function prepareDOM () {
  const { window, document } = createLinkeDOM()

  const _window = global.window
  const _document = global.document

  global.window = window
  global.document = document

  return () => {
    global.window = _window
    global.document = _document
  }
}

function prepareWindow () {
  const _window = global.window
  // required for code nodes
  // https://github.com/facebook/lexical/pull/5828
  global.window = global

  return () => {
    global.window = _window
  }
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

  // setup window and create editor
  // window is necessary for code nodes
  const cleanupWindow = prepareWindow()
  const editor = createSNHeadlessEditor(editorOptions)

  try {
    editor.setEditorState(editor.parseEditorState(lexicalState))
  } catch (error) {
    console.error('error setting editor state: ', error)
    cleanupWindow()
    return 'error generating HTML, another attempt will be made. the text will be hydrated in a moment.'
  }

  cleanupWindow()

  // setup DOM and generate HTML
  // DOM is necessary for HTML and sanitization
  const cleanupDOM = prepareDOM()
  let html = ''

  editor.update(() => {
    try {
      html = $generateHtmlFromNodes(editor, selection)
      if (sanitize) {
        html = sanitizeHTML(html, global.window)
      }
    } catch (error) {
      // if the html conversion fails, we'll use the lexicalState directly
      // this might be a problem for instant content
      console.error('error generating HTML in SSR from Lexical State: ', error)
      html = 'error generating HTML, another attempt will be made. the text will be hydrated in a moment.'
    }
  })

  cleanupDOM()

  return html
}

// returns lexical nodes from HTML
export function ssrLexicalHTMLImporter (html, editorOptions = {}) {
  if (typeof window !== 'undefined') {
    throw new Error('can\'t use ssrLexicalHTMLImporter in a client environment')
  }

  // headless editor supporting custom options
  const editor = createSNHeadlessEditor(editorOptions)

  // JS DOM setup
  const dom = createLinkeDOM(html)

  // generate nodes from DOM
  return $generateNodesFromDOM(editor, dom)
}
