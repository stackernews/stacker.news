// DOMPurify for SSR and client envs

export function getDOMPurify () {
  const DOMPurify = require('dompurify')

  if (typeof window === 'undefined') {
    const { JSDOM } = require('jsdom')
    const { window } = new JSDOM('<!DOCTYPE html>')
    return DOMPurify(window)
  }

  return DOMPurify
}

export function sanitizeHTML (html) {
  return getDOMPurify().sanitize(html)
}
