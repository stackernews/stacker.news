export default function preserveScroll (callback) {
  // preserve the actual scroll position
  const scrollTop = window.scrollY

  // if the scroll position is at the top, we don't need to preserve it, just call the callback
  if (scrollTop <= 0) {
    callback()
    return
  }

  // check if a ref element is in the viewport
  const isElementInViewport = (element) => {
    if (!element?.getBoundingClientRect) return false

    const rect = element.getBoundingClientRect()
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    )
  }

  // pick a textarea element to use as anchor ref, if any
  const selectTextarea = () => {
    // pick the focused textarea, if any
    const active = document.activeElement
    if (active && active.tagName === 'TEXTAREA' && isElementInViewport(active)) {
      return active
    }

    // if no textarea is focused, check if there are any in the viewport
    const textareas = document.querySelectorAll('textarea')
    for (const textarea of textareas) {
      if (isElementInViewport(textarea)) {
        return textarea
      }
    }

    return null
  }

  // if no textarea is found, use the center of the viewport as fallback anchor
  const anchorRef = selectTextarea() || document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
  const refTop = anchorRef ? anchorRef.getBoundingClientRect().top + scrollTop : scrollTop

  callback()

  // double rAF to ensure the DOM is updated - textareas are rendered on the next tick
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!anchorRef) return

      // bail if user scrolled manually
      if (window.scrollY !== scrollTop) return

      // get the new position of the anchor ref along with the new scroll position
      const newRefTop = anchorRef.getBoundingClientRect().top + window.scrollY
      // has the anchor ref moved?
      const refMoved = newRefTop - refTop

      // if the anchor ref moved, we need to scroll to the new position
      if (refMoved > 0) {
        window.scrollTo({
          // some browsers don't respond well to fractional scroll position, so we round up the new position to the nearest integer
          top: scrollTop + Math.ceil(refMoved),
          behavior: 'instant'
        })
      }
    })
  })
}
