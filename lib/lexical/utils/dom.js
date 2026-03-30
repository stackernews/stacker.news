import { getDOMSelectionFromTarget } from 'lexical'

/**
 * gets the drag selection from the event
 * @param {Event} event - the drag event
 * @returns {Range} the drag selection
 */
export function getDragSelection (event) {
  if (!event.target) {
    throw Error('cannot get drag selection')
  }

  let range
  const domSelection = getDOMSelectionFromTarget(event.target)
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(event.clientX, event.clientY)
  } else if (event.rangeParent && domSelection !== null) {
    domSelection.collapse(event.rangeParent, event.rangeOffset || 0)
    range = domSelection.getRangeAt(0)
  } else {
    throw Error('cannot get drag selection when dragging')
  }

  return range
}
