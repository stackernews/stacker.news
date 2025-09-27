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
