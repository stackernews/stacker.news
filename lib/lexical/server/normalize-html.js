const LEXICAL_DEFAULT_TABLE_CELL_WIDTH = '75px'

function createFallbackDocument () {
  if (typeof window !== 'undefined') {
    return window.document
  }

  const { parseHTML } = require('linkedom')
  return parseHTML('<!doctype html><body></body>').document
}

function normalizeStyleAttribute (element) {
  const style = element.getAttribute('style')
  if (!style || style.trim() === '') {
    element.removeAttribute('style')
  }
}

export function normalizeLexicalHTML (html, domWindow = globalThis.window) {
  const doc = domWindow?.document ?? globalThis.document ?? createFallbackDocument()
  const wrapper = doc.createElement('div')
  wrapper.innerHTML = html

  wrapper.querySelectorAll('.sn-table__cell').forEach((cell) => {
    cell.style.removeProperty('border')
    cell.style.removeProperty('vertical-align')
    cell.style.removeProperty('text-align')
    cell.style.removeProperty('background-color')

    if (cell.style.width === LEXICAL_DEFAULT_TABLE_CELL_WIDTH) {
      cell.style.removeProperty('width')
    }

    normalizeStyleAttribute(cell)
  })

  return wrapper.innerHTML
}
