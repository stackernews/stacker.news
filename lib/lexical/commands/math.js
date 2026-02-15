import { createCommand, COMMAND_PRIORITY_EDITOR, $insertNodes, $isRootOrShadowRoot, $createParagraphNode, $getSelection, $isRangeSelection } from 'lexical'
import { $wrapNodeInElement } from '@lexical/utils'
import { MathNode, $createMathNode } from '@/lib/lexical/nodes/formatting/math'
import { isMarkdownMode } from '@/lib/lexical/commands/utils'
import { MD_FORMAT_COMMAND } from '@/lib/lexical/commands/formatting/markdown'
import { USE_TRANSFORMER_BRIDGE } from '@/components/editor/plugins/core/transformer-bridge'

/** command to insert math equations (inline or block)
 * @param {string} math - math equation, if empty, it uses the selection text content, or '2+2=5'
 * @param {boolean} inline - whether to insert inline math
 * @returns {boolean} true if command was handled
 */
export const SN_INSERT_MATH_COMMAND = createCommand('SN_INSERT_MATH_COMMAND')

export function $insertMath (editor, { math = '', inline = false } = {}) {
  const selection = $getSelection()

  let mathValue = math
  if (!mathValue && selection && $isRangeSelection(selection)) {
    mathValue = selection.getTextContent()
  }
  if (!mathValue) {
    mathValue = '2+2=5'
  }

  console.log('math value', mathValue, inline)
  const mathNode = $createMathNode(mathValue, inline)

  $insertNodes([mathNode])
  if ($isRootOrShadowRoot(mathNode.getParentOrThrow())) {
    $wrapNodeInElement(mathNode, $createParagraphNode).selectEnd()
  }
  return true
}

/**
 * registers command to insert math equations (inline or block)
 * default is 2+2=5
 * @param {Object} params.editor - lexical editor instance
 * @returns {Function} unregister function or false if MathNode not available
 */
export function registerSNInsertMathCommand (editor) {
  return editor.registerCommand(SN_INSERT_MATH_COMMAND, ({ math = '', inline = false } = {}) => {
    console.log('insert math', math, inline)
    const markdownMode = isMarkdownMode()
    const selection = $getSelection()

    if (!markdownMode) {
      return $insertMath(editor, { math, inline })
    }

    if (!$isRangeSelection(selection) || selection.isCollapsed()) {
      editor.dispatchCommand(MD_FORMAT_COMMAND, inline ? 'inlineMath' : 'math')
      return true
    }

    return editor.dispatchCommand(USE_TRANSFORMER_BRIDGE, { formatType: 'math', transformation: { math, inline } })
  }, COMMAND_PRIORITY_EDITOR)
}
