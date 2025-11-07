/**
 * creates a fake DOM using LinkeDOM for server-side rendering
 * @param {string} html - HTML content to parse
 * @returns {Object} parsed HTML object with window and document
 */
export function createLinkeDOM (html) {
  const { parseHTML } = require('linkedom')
  return parseHTML(html || '<!DOCTYPE html>')
}

/**
 * returns DOMPurify instance for either browser or server environment
 * @param {Object} [domWindow] - optional DOM window object (for server-side)
 * @returns {Object} DOMPurify instance
 */
export function getDOMPurify (domWindow) {
  const DOMPurify = require('dompurify')

  if (typeof window === 'undefined') {
    if (domWindow) {
      return DOMPurify(domWindow)
    }
    const { window } = createLinkeDOM()
    return DOMPurify(window)
  }

  return DOMPurify
}

/**
 * sanitizes HTML using DOMPurify with optional custom DOM window
 * @param {string} html - HTML content to sanitize
 * @param {Object} [domWindow] - optional DOM window object
 * @returns {string} sanitized HTML string
 */
export function sanitizeHTML (html, domWindow) {
  return getDOMPurify(domWindow).sanitize(html)
}

/**
 * parses and sanitizes HTML, returning a document object
 * @param {string} html - HTML content to parse and sanitize
 * @returns {Document} parsed and sanitized document object
 */
export function getParsedHTML (html) {
  if (typeof window === 'undefined') {
    const normalizedHTML = !html.toLowerCase().startsWith('<!doctype html>')
      ? `<!doctype html>
          <html lang="en">
            <body>
              ${html}
            </body>
          </html>`
      : html
    const parsed = createLinkeDOM(normalizedHTML)
    const domWindow = parsed.window

    // sanitize
    const sanitizedHTML = getDOMPurify(domWindow).sanitize(html)

    // update the body with sanitized content
    parsed.document.body.innerHTML = sanitizedHTML
    return parsed.document
  }

  // client-side
  const sanitizedHTML = sanitizeHTML(html)
  return new window.DOMParser().parseFromString(sanitizedHTML, 'text/html')
}
