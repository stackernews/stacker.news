function applyFloatingElementPosition ({ floatingElem, anchorElem, top, left, fade }) {
  const anchorElemRect = anchorElem.getBoundingClientRect()

  top -= anchorElemRect.top
  left -= anchorElemRect.left

  // fade out before repositioning
  if (fade) {
    floatingElem.style.opacity = '0'
  }

  setTimeout(() => {
    floatingElem.style.transform = `translate(${left}px, ${top}px)`
    floatingElem.style.opacity = '1'
  }, fade ? 200 : 0)
}

function hideFloatingElement (floatingElem) {
  floatingElem.style.opacity = '0'
  floatingElem.style.transform = 'translate(-10000px, -10000px)'
}

function getPositioningRects ({ floatingElem, anchorElem, targetRect }) {
  const scrollerElem = anchorElem.parentElement

  if (targetRect === null || !scrollerElem) {
    return null
  }

  return {
    floatingElemRect: floatingElem.getBoundingClientRect(),
    anchorElemRect: anchorElem.getBoundingClientRect(),
    editorScrollerRect: scrollerElem.getBoundingClientRect(),
    scrollerElem
  }
}

export function setFloatingElemPosition ({ targetRect, floatingElem, anchorElem, verticalGap = 10, horizontalOffset = 5, fade = false }) {
  const rects = getPositioningRects({ floatingElem, anchorElem, targetRect })

  if (!rects) {
    hideFloatingElement(floatingElem)
    return
  }

  const { floatingElemRect, editorScrollerRect } = rects

  let top = targetRect.top - verticalGap
  let left = targetRect.left - horizontalOffset

  if (top < editorScrollerRect.top) {
    top += floatingElemRect.height + targetRect.height + verticalGap * 2
  }

  if (left + floatingElemRect.width > editorScrollerRect.right) {
    left = editorScrollerRect.right - floatingElemRect.width - horizontalOffset
  }

  applyFloatingElementPosition({ floatingElem, anchorElem, top, left, fade })
}

export function setFloatingToolbarPosition ({ targetRect, floatingElem, anchorElem, verticalGap = 10, horizontalOffset = 5, fade = false, isLink = false }) {
  const rects = getPositioningRects({ floatingElem, anchorElem, targetRect })

  if (!rects) {
    hideFloatingElement(floatingElem)
    return
  }

  const { floatingElemRect, editorScrollerRect } = rects

  let top = targetRect.top - floatingElemRect.height - verticalGap
  let left = targetRect.left - horizontalOffset

  // check if text is end-aligned
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const textNode = range.startContainer
    if (textNode.nodeType === 1 || textNode.parentElement) {
      const textElement =
        textNode.nodeType === 1
          ? (textNode)
          : (textNode.parentElement)
      const textAlign = window.getComputedStyle(textElement).textAlign

      if (textAlign === 'right' || textAlign === 'end') {
        // for end-aligned text, position the toolbar relative to the text end
        left = targetRect.right - floatingElemRect.width + horizontalOffset
      }
    }
  }

  if (top < editorScrollerRect.top) {
    // adjusted height for link element if the element is at top
    top +=
      floatingElemRect.height +
      targetRect.height +
      verticalGap * (isLink ? 4 : 2)
  }

  if (left + floatingElemRect.width > editorScrollerRect.right) {
    left = editorScrollerRect.right - floatingElemRect.width - horizontalOffset
  }

  if (left < editorScrollerRect.left) {
    left = editorScrollerRect.left + horizontalOffset
  }

  applyFloatingElementPosition({ floatingElem, anchorElem, top, left, fade })
}
