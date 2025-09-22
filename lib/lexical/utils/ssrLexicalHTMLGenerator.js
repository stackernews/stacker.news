// TODO: cleanup, better name I suppose?
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'
import { sanitizeHTML, createLinkeDOM } from '../../dompurify'
import createSNHeadlessEditor from '@/lib/lexical/utils/headlessEditor'

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

  const cleanupWindow = prepareWindow()
  const editor = createSNHeadlessEditor(editorOptions)

  editor.setEditorState(editor.parseEditorState(lexicalState))
  cleanupWindow()

  let html = ''
  editor.update(() => {
    try {
      const cleanupDOM = prepareDOM()
      html = $generateHtmlFromNodes(editor, selection)
      if (sanitize) {
        html = sanitizeHTML(html, global.window)
      }
      cleanupDOM()
    } catch (error) {
      console.error('error generating HTML in SSR from Lexical State: ', error)
      html = ''
    }
  })

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
