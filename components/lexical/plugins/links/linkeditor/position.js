export function setFloatingElemPosition ({ targetRect, floatingElem, anchorElem, verticalGap = 10, horizontalOffset = 5, fade = true }) {
  const scrollerElem = anchorElem.parentElement

  if (targetRect === null || !scrollerElem) {
    floatingElem.style.opacity = '0'
    floatingElem.style.visibility = 'hidden'
    return
  }

  const floatingElemRect = floatingElem.getBoundingClientRect()
  const anchorElemRect = anchorElem.getBoundingClientRect()
  const editorScrollerRect = scrollerElem.getBoundingClientRect()

  let top = targetRect.top - verticalGap
  let left = targetRect.left - horizontalOffset

  if (top < editorScrollerRect.top) {
    top += floatingElemRect.height + targetRect.height + verticalGap * 2
  }

  if (left + floatingElemRect.width > editorScrollerRect.right) {
    left = editorScrollerRect.right - floatingElemRect.width - horizontalOffset
  }

  top -= anchorElemRect.top
  left -= anchorElemRect.left

  // fade out before repositioning
  if (fade) {
    floatingElem.style.opacity = '0'
  }

  setTimeout(() => {
    floatingElem.style.visibility = 'visible'
    floatingElem.style.transform = `translate(${left}px, ${top}px)`
    floatingElem.style.opacity = '1'
  }, fade ? 200 : 0)
}
