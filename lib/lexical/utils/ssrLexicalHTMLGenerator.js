// TODO: cleanup, better name I suppose?
import { createHeadlessEditor } from '@lexical/headless'
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'
import { sanitizeHTML, createJSDOM } from '../../dompurify'
import snTheme from '@/lexical/theme'
import DefaultNodes from '@/lib/lexical/nodes'

function prepareDOM () {
  const dom = createJSDOM()

  const _window = global.window
  const _document = global.document
  const _documentFragment = global.DocumentFragment
  const _navigator = global.navigator

  global.window = dom.window
  global.document = dom.window.document
  global.DocumentFragment = dom.window.DocumentFragment
  global.navigator = dom.window.navigator

  return () => {
    global.window = _window
    global.document = _document
    global.DocumentFragment = _documentFragment
    global.navigator = _navigator
  }
}

// creates a headless editor with SN default options
function createSNHeadlessEditor (options) {
  // default values
  const {
    namespace = 'snSSR',
    theme = snTheme,
    nodes = [...DefaultNodes],
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
  let cleanup = null

  try {
    // headless editor supporting custom options
    const editor = createSNHeadlessEditor(editorOptions)

    // JS DOM setup
    cleanup = prepareDOM()

    // set the editor state
    const editorState = editor.parseEditorState(lexicalState)
    editor.setEditorState(editorState)
    editor.getEditorState().read(() => {
      html = $generateHtmlFromNodes(editor, selection)
    })

    if (sanitize) {
      html = sanitizeHTML(html, global.window)
    }

    return html
  } catch (error) {
    console.error('error generating HTML in SSR from Lexical State: ', error)
    return ''
  } finally {
    // proper cleanup - restore original values
    cleanup()
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
