import { createHeadlessEditor } from '@lexical/headless'
import DefaultTheme from '@/lib/lexical/theme'
import DefaultNodes from '@/lib/lexical/nodes'
import { createLinkeDOM } from '@/lib/dompurify'

/** wraps a function with a fake DOM environment for SSR
 *
 * manages global DOM variables and cleans up after execution
 *
 * if! a DOM already exists (nested calls), reuses it to avoid creating multiple DOMs
 * @param {Function} fn - function to wrap
 * @returns {Object} result of the function
 */
export function withDOM (fn) {
  const prevWindow = global.window

  // if window already exists, we're in a nested call and we'll reuse the existing DOM
  if (prevWindow) {
    return fn(prevWindow)
  }

  // save previous global state
  const prevDocument = global.document

  // create new DOM environment
  const { window: newWindow, document: newDocument } = createLinkeDOM()
  global.window = newWindow
  global.document = newDocument

  try {
    return fn(newWindow)
  } finally {
    // restore previous state and clean up
    global.window = prevWindow
    global.document = prevDocument
  }
}

/** creates a headless editor with SN default options
 * @param {Object} options - editor options
 * @param {string} options.namespace - editor namespace
 * @param {Object} options.theme - editor theme
 * @param {Array} options.nodes - editor nodes
 * @param {Function} options.onError - error handler
 * @returns {Object} headless editor instance
 */
export function createSNHeadlessEditor (options = {}) {
  // default values
  const {
    namespace = 'snSSR',
    theme = DefaultTheme,
    nodes = DefaultNodes,
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
