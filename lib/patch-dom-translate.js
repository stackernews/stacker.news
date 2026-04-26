/* global Node */

let translateActive = false

function detectDOMTranslate () {
  const html = document.documentElement
  if (!html) return false

  // classes used by DOM translators
  if (html.classList.contains('translated-ltr')) return true
  if (html.classList.contains('translated-rtl')) return true
  if (html.classList.contains('translated')) return true

  return false
}

/**
 * workaround for DOM translators, facebook/react#11538
 * browser translation engines wrap text nodes in <font> tags,
 * which desyncs React's reconciler from the real DOM and throws
 * `NotFoundError` on `removeChild` and `insertBefore`
 *
 * We only suppress these errors while a DOM translator is active
 */
export function patchDOMTranslations () {
  if (typeof Node === 'undefined' || typeof window === 'undefined') return
  if (Node.prototype.__patchedDOMTranslations) return

  Node.prototype.__patchedDOMTranslations = true

  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      if (translateActive) {
        return child
      }
    }
    return originalRemoveChild.call(this, child)
  }

  const originalInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (translateActive) {
        return newNode
      }
    }
    return originalInsertBefore.call(this, newNode, referenceNode)
  }

  const update = () => { translateActive = detectDOMTranslate() }
  update()

  const observer = new window.MutationObserver(update)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'lang']
  })
}
