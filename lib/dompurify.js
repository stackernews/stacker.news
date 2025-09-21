// DOMPurify for SSR and client envs
export function createJSDOM (html) {
  const { JSDOM } = require('jsdom')
  return new JSDOM(html || '<!DOCTYPE html>')
}

export function getDOMPurify (dom) {
  const DOMPurify = require('dompurify')

  if (typeof window === 'undefined') {
    if (dom) {
      return DOMPurify(dom.window)
    }
    const { window } = createJSDOM()
    return DOMPurify(window)
  }

  return DOMPurify
}

// If we have a DOM already, pass it to the function
// otherwise the function will create a new DOM
export function sanitizeHTML (html, dom) {
  return getDOMPurify(dom).sanitize(html)
}
