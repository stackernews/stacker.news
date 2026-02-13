/**
 * positions a floating element relative to anchor with optional fade animation
 * @param {HTMLElement} params.floatingElem - floating element to position
 * @param {HTMLElement} params.anchorElem - anchor element for relative positioning
 * @param {number} params.top - top position in pixels
 * @param {number} params.left - left position in pixels
 * @param {boolean} params.fade - whether to fade out before repositioning
 */
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

/**
 * hides a floating element off-screen
 * @param {HTMLElement} floatingElem - floating element to hide
 */
function hideFloatingElement (floatingElem) {
  floatingElem.style.opacity = '0'
  floatingElem.style.transform = 'translate(-10000px, -10000px)'
}

/**
 * calculates positioning rectangles for floating elements
 * @param {HTMLElement} params.floatingElem - floating element
 * @param {HTMLElement} params.anchorElem - anchor element
 * @param {DOMRect} params.targetRect - target rectangle
 * @returns {Object|null} object with positioning rects or null if unavailable
 */
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

/**
 * sets floating element position with gap/offset and collision detection
 * @param {DOMRect} params.targetRect - target rectangle to position near
 * @param {HTMLElement} params.floatingElem - floating element to position
 * @param {HTMLElement} params.anchorElem - anchor element
 * @param {number} [params.verticalGap=10] - vertical gap in pixels
 * @param {number} [params.horizontalOffset=5] - horizontal offset in pixels
 * @param {boolean} [params.fade=false] - whether to fade during positioning
 */
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

/**
 * sets floating toolbar position with text alignment detection
 * @param {DOMRect} params.targetRect - target rectangle to position near
 * @param {HTMLElement} params.floatingElem - floating toolbar element
 * @param {HTMLElement} params.anchorElem - anchor element
 * @param {number} [params.verticalGap=10] - vertical gap in pixels
 * @param {number} [params.horizontalOffset=5] - horizontal offset in pixels
 * @param {boolean} [params.fade=false] - whether to fade during positioning
 * @param {boolean} [params.isLink=false] - whether toolbar is for link editing
 */
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
