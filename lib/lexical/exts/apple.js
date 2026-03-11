import {
  defineExtension, KEY_BACKSPACE_COMMAND,
  COMMAND_PRIORITY_HIGH,
  $getSelection, $isRangeSelection, $isNodeSelection,
  $isDecoratorNode, KEY_ENTER_COMMAND, COMMAND_PRIORITY_NORMAL, $createParagraphNode
} from 'lexical'
import { CAN_USE_BEFORE_INPUT, IS_IOS, IS_SAFARI, IS_APPLE_WEBKIT, mergeRegister } from '@lexical/utils'
import { $isUnwritable } from '@/lib/lexical/nodes/utils'

/**
 * Safari's native deleteContentBackward can't handle any deletion that
 * involves a contenteditable="false" element (decorator node). We detect
 * every position where backspace would hit one and let Lexical handle it.
 */
function $backspaceHitsDecorator (selection) {
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false

  const { anchor } = selection

  if (anchor.type === 'element') {
    const node = anchor.getNode()

    if (anchor.offset === 0) {
      // cursor at the start of an element — backspace merges with previous block
      const topBlock = node.getTopLevelElement?.() ?? node
      const prev = topBlock.getPreviousSibling()
      return prev != null && $isUnwritable(prev)
    }

    // cursor after a child — backspace would delete that child
    const children = node.getChildren()
    const childBefore = children[anchor.offset - 1]
    return childBefore != null && $isDecoratorNode(childBefore)
  }

  if (anchor.type === 'text') {
    if (anchor.offset === 0) {
      const textNode = anchor.getNode()

      // inline decorator immediately before this text node
      const prevSibling = textNode.getPreviousSibling()
      if (prevSibling && $isDecoratorNode(prevSibling)) return true

      // at the very start of a block — check previous block
      const topBlock = textNode.getTopLevelElement?.()
      if (topBlock && topBlock.getFirstDescendant() === textNode) {
        const prev = topBlock.getPreviousSibling()
        return prev != null && $isUnwritable(prev)
      }
    }
  }

  return false
}

const IS_APPLE = (IS_IOS || IS_SAFARI || IS_APPLE_WEBKIT) && CAN_USE_BEFORE_INPUT

/**
 * Apple platforms update their autocorrect buffer via the `beforeInput` event.
 * Lexical's KEY_BACKSPACE_COMMAND calls preventDefault() on keydown, which
 * suppresses beforeInput and breaks autocorrect, autocompletion, and
 * hold-to-delete-word. We return true (handled) at HIGH priority so Lexical
 * skips preventDefault and lets the native event fire.
 *
 * Safari's native beforeInput can't interact with contenteditable="false"
 * (decorator nodes), so we fall through (return false) in two cases:
 *  - NodeSelection: a decorator is focused and needs its own delete handler
 *  - The cursor is adjacent to a decorator in any direction
 *
 * The same limitation affects KEY_ENTER_COMMAND: Safari's native
 * insertParagraph is a no-op inside blocks containing only decorators,
 * so we insert the paragraph explicitly.
 *
 * @see https://github.com/facebook/lexical/issues/7994
 */
export const ApplePatchExtension = defineExtension({
  name: 'apple-patch',
  register: (editor) => {
    return mergeRegister(
      editor.registerCommand(KEY_BACKSPACE_COMMAND, () => {
        if (!IS_APPLE) return false
        const selection = $getSelection()
        if ($isNodeSelection(selection)) return false
        if ($backspaceHitsDecorator(selection)) return false
        return true
      }, COMMAND_PRIORITY_HIGH),

      editor.registerCommand(KEY_ENTER_COMMAND, (event) => {
        if (!IS_APPLE) return false
        const selection = $getSelection()
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false
        const topBlock = selection.anchor.getNode().getTopLevelElement?.()
        if (!topBlock || !$isUnwritable(topBlock)) return false
        event?.preventDefault()
        const paragraph = $createParagraphNode()
        topBlock.insertAfter(paragraph)
        paragraph.select()
        return true
      }, COMMAND_PRIORITY_NORMAL)
    )
  }
})
