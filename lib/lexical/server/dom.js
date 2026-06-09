import { createLinkeDOM } from '@/lib/dompurify'

/** whether we're currently painting Lexical into the SSR fake DOM.
 * withDOM points global.window at the linkedom window, letting decorator nodes
 * paint a static representation in createDOM (their React component only mounts
 * on the client).
*/
export const isServerRendering = () => !!globalThis.window?.__SN_LEXICAL_SSR__

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
  const prevComputedStyle = global.getComputedStyle
  const prevDOMParser = global.DOMParser
  const prevMutationObserver = global.MutationObserver
  const prevDocument = global.document

  // create new DOM environment
  const { window: newWindow, document: newDocument } = createLinkeDOM()
  // mark this window as the SSR painting environment (see isServerRendering);
  // it's discarded with the window, so no cleanup is needed
  newWindow.__SN_LEXICAL_SSR__ = true
  global.window = newWindow
  global.document = newDocument
  global.getComputedStyle = newWindow.getComputedStyle
  global.DOMParser = newWindow.DOMParser
  global.MutationObserver = newWindow.MutationObserver

  try {
    return fn(newWindow)
  } finally {
    // restore previous state and clean up
    global.getComputedStyle = prevComputedStyle
    global.DOMParser = prevDOMParser
    global.MutationObserver = prevMutationObserver
    global.window = prevWindow
    global.document = prevDocument
  }
}
