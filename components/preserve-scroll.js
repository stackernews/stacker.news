export default function preserveScroll (callback) {
  // preserve the actual scroll position
  const scrollTop = window.scrollY

  // if the scroll position is at the top, we don't need to preserve it
  if (scrollTop <= 0) {
    callback()
    return
  }

  // get the initial document height
  const initialDocumentHeight = document.documentElement.scrollHeight

  // observe the document for changes in height
  const observer = new window.MutationObserver(() => {
    // request animation frame to ensure the DOM is updated
    window.requestAnimationFrame(() => {
      const heightDifference = document.documentElement.scrollHeight - initialDocumentHeight

      // if we have a height difference, we need to scroll to the new position
      if (heightDifference > 0) {
        window.scrollTo({
          top: scrollTop + heightDifference,
          behavior: 'instant'
        })
      }

      observer.disconnect()
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })
  setTimeout(() => observer.disconnect(), 1000) // fallback??

  callback()
}
