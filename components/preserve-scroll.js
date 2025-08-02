export default function preserveScroll (callback) {
  // preserve the actual scroll position
  const scrollTop = window.scrollY

  // if the scroll position is at the top, we don't need to preserve it, just call the callback
  if (scrollTop <= 0) {
    callback()
    return
  }

  // get a reference element at the center of the viewport to track if content is added above it
  const ref = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
  const refTop = ref ? ref.getBoundingClientRect().top + scrollTop : scrollTop

  // observe the document for changes in height
  const observer = new window.MutationObserver(() => {
    // request animation frame to ensure the DOM is updated
    window.requestAnimationFrame(() => {
      // we can't proceed if we couldn't find a traceable reference element
      if (!ref) {
        cleanup()
        return
      }

      // get the new position of the reference element along with the new scroll position
      const newRefTop = ref ? ref.getBoundingClientRect().top + window.scrollY : window.scrollY
      // has the reference element moved?
      const refMoved = newRefTop - refTop

      // if the reference element moved, we need to scroll to the new position
      if (refMoved > 0) {
        window.scrollTo({
          top: scrollTop + Math.ceil(refMoved),
          behavior: 'instant'
        })
      }

      cleanup()
    })
  })

  const timeout = setTimeout(() => cleanup(), 1000) // fallback

  function cleanup () {
    clearTimeout(timeout)
    observer.disconnect()
  }

  observer.observe(document.body, { childList: true, subtree: true })

  callback()
}
