// LinkeDOM fake DOM for SSR and client envs
export function createLinkeDOM (html) {
  const { parseHTML } = require('linkedom')
  return parseHTML(html || '<!DOCTYPE html>')
}

// DOMPurify for SSR and client envs
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

// If we have a DOM already, pass it to the function
// otherwise the function will create a new DOM
export function sanitizeHTML (html, domWindow) {
  return getDOMPurify(domWindow).sanitize(html)
}

// parse HTML and sanitize it
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
