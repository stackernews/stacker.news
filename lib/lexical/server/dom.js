/**
 * creates a fake DOM using LinkeDOM for server-side rendering
 * @param {string} html - HTML content to parse
 * @returns {Object} parsed HTML object with window and document
 */
export function createLinkeDOM (html) {
  // the typeof window guard is compile-time constant in Next bundles,
  // so webpack drops linkedom from client builds entirely
  if (typeof window === 'undefined') {
    const { parseHTML } = require('linkedom')
    return parseHTML(html || '<!DOCTYPE html>')
  }
  throw new Error('createLinkeDOM is server-only')
}

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
  const prevDOMParser = global.DOMParser
  const prevMutationObserver = global.MutationObserver
  const prevDocument = global.document

  // create new DOM environment
  const { window: newWindow, document: newDocument } = createLinkeDOM()
  global.window = newWindow
  global.document = newDocument
  global.DOMParser = newWindow.DOMParser
  global.MutationObserver = newWindow.MutationObserver

  try {
    return fn(newWindow)
  } finally {
    // restore previous state and clean up
    global.DOMParser = prevDOMParser
    global.MutationObserver = prevMutationObserver
    global.window = prevWindow
    global.document = prevDocument
  }
}
