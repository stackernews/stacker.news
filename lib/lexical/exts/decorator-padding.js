import { defineExtension, $isDecoratorNode, $isElementNode, $createParagraphNode, RootNode } from 'lexical'

/**
 * "unwritable" if the browser can't place a caret inside it,
 *  cases like DecoratorNode or ElementNode whose children are ALL DecoratorNodes
 */
function isUnwritable (node) {
  if ($isDecoratorNode(node)) return true
  if ($isElementNode(node)) {
    const children = node.getChildren()
    return children.length > 0 && children.every($isDecoratorNode)
  }
  return false
}

/**
 * ensures there is always a writable paragraph before and after every group
 * of adjacent decorator / unwritable nodes at the root level.
 */
export const DecoratorPaddingExtension = defineExtension({
  name: 'DecoratorPaddingExtension',
  register: (editor) => {
    return editor.registerNodeTransform(RootNode, (root) => {
      const children = root.getChildren()
      if (children.length === 0) return

      if (isUnwritable(children[0])) {
        children[0].insertBefore($createParagraphNode())
      }

      // re-read after possible insert above
      const updated = root.getChildren()
      const last = updated[updated.length - 1]
      if (isUnwritable(last)) {
        last.insertAfter($createParagraphNode())
      }
    })
  }
})
