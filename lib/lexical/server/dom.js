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
