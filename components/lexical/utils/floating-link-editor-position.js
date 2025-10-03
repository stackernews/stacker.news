export function setFloatingElemPositionForLinkEditor (targetRect, floatingElem, anchorElem, verticalGap = 10, horizontalOffset = 5) {
  const scrollerElem = anchorElem.parentElement

  if (targetRect === null || !scrollerElem) {
    floatingElem.style.display = 'none'
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

  floatingElem.style.display = 'block'
  floatingElem.style.transform = `translate(${left}px, ${top}px)`
}
