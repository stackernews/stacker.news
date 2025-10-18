import { createCommand, COMMAND_PRIORITY_EDITOR, $insertNodes, $isRootOrShadowRoot, $createParagraphNode, $getSelection, $isRangeSelection } from 'lexical'
import { $wrapNodeInElement } from '@lexical/utils'
import { MathNode, $createMathNode } from '@/lib/lexical/nodes/formatting/math/mathnode'

export const SN_INSERT_MATH_COMMAND = createCommand('SN_INSERT_MATH_COMMAND')

export function registerSNInsertMathCommand ({ editor }) {
  // don't consider this command if MathNode is deactivated
  if (!editor.hasNodes([MathNode])) return false

  return editor.registerCommand(SN_INSERT_MATH_COMMAND, ({ math = '', inline = false } = {}) => {
    const selection = $getSelection()

    let mathValue = math
    if (!mathValue && selection && $isRangeSelection(selection)) {
      mathValue = selection.getTextContent()
    }
    if (!mathValue) {
      mathValue = '2+2=5'
    }

    // ok now add the markdown equivalent, don't forget about this.
    const mathNode = $createMathNode(mathValue, inline)

    $insertNodes([mathNode])
    if ($isRootOrShadowRoot(mathNode.getParentOrThrow())) {
      $wrapNodeInElement(mathNode, $createParagraphNode).selectEnd()
    }
    return true
  }, COMMAND_PRIORITY_EDITOR)
}
