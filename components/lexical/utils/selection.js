import { $isAtNodeEnd } from '@lexical/selection'

export function getSelectedNode (selection) {
  const anchor = selection.anchor
  const focus = selection.focus
  const anchorNode = anchor.getNode()
  const focusNode = focus.getNode()

  if (anchorNode === focusNode) {
    return anchorNode
  }

  const isBackward = selection.isBackward()
  if (isBackward) {
    return $isAtNodeEnd(focus) ? anchorNode : focusNode
  } else {
    return $isAtNodeEnd(anchor) ? anchorNode : focusNode
  }
}
