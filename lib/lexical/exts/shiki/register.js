import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $createTabNode,
  COMMAND_PRIORITY_LOW,
  KEY_TAB_COMMAND,
  INSERT_TAB_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  MOVE_TO_START,
  MOVE_TO_END,
  TextNode,
  $insertNodes
} from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { CodeNode, CodeHighlightNode, $isCodeNode } from '@lexical/code-core'
import {
  $codeNodeTransform,
  $textNodeTransform,
  $isSelectionInCode,
  updateCodeGutter
} from '@/lib/lexical/exts/shiki/transforms'
import {
  $handleTab,
  $handleMultilineIndent,
  $handleShiftLines,
  $handleMoveTo
} from '@/lib/lexical/exts/shiki/handlers'

// wires the tokenizer to the editor: TextNode/CodeNode/CodeHighlightNode
// transforms drive the highlight pass, KEY_TAB/INDENT/OUTDENT handle code-
// aware indentation, KEY_ARROW_UP/DOWN power Alt+arrow line shifts plus
// edge-of-code-block selection escape, and MOVE_TO_START/END jumps to first
// non-indent / last char within the current code line.
export function registerCodeHighlighting (editor, tokenizer) {
  if (!editor.hasNodes([CodeNode, CodeHighlightNode])) {
    throw new Error('CodeShikiSNExtension: CodeNode or CodeHighlightNode not registered on editor')
  }

  const registrations = []

  // keeps the data-gutter attribute (line numbers) in sync with the children
  // count. skipped in headless mode because there's no DOM to update.
  if (editor._headless !== true) {
    registrations.push(
      editor.registerMutationListener(
        CodeNode,
        mutations => {
          editor.getEditorState().read(() => {
            for (const [key, type] of mutations) {
              if (type !== 'destroyed') {
                const node = $getNodeByKey(key)
                if (node !== null) updateCodeGutter(node, editor)
              }
            }
          })
        },
        { skipInitialization: false }
      )
    )
  }

  // shared state across the three transforms below so a single editor update
  // doesn't tokenize the same CodeNode multiple times
  const transformState = {
    didTransform: false,
    nodesCurrentlyHighlighting: new Set()
  }

  registrations.push(
    editor.registerNodeTransform(CodeNode, node => $codeNodeTransform(editor, tokenizer, transformState, node)),
    editor.registerNodeTransform(TextNode, node => $textNodeTransform(editor, tokenizer, transformState, node)),
    editor.registerNodeTransform(CodeHighlightNode, node => $textNodeTransform(editor, tokenizer, transformState, node)),
    editor.registerCommand(
      KEY_TAB_COMMAND,
      event => {
        const command = $handleTab(event.shiftKey)
        if (command === null) return false
        event.preventDefault()
        editor.dispatchCommand(command, undefined)
        return true
      },
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand(
      INSERT_TAB_COMMAND,
      () => {
        const selection = $getSelection()
        if (!$isSelectionInCode(selection)) return false
        $insertNodes([$createTabNode()])
        return true
      },
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand(INDENT_CONTENT_COMMAND, () => $handleMultilineIndent(INDENT_CONTENT_COMMAND), COMMAND_PRIORITY_LOW),
    editor.registerCommand(OUTDENT_CONTENT_COMMAND, () => $handleMultilineIndent(OUTDENT_CONTENT_COMMAND), COMMAND_PRIORITY_LOW),
    editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      event => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false
        const anchorNode = selection.anchor.getNode()
        if (!$isSelectionInCode(selection)) return false
        // prevent caret from leaving the code block on collapsed up-arrow at start
        if (
          selection.isCollapsed() &&
          selection.anchor.offset === 0 &&
          anchorNode.getPreviousSibling() === null &&
          $isCodeNode(anchorNode.getParentOrThrow())
        ) {
          event.preventDefault()
          return true
        }
        return $handleShiftLines(KEY_ARROW_UP_COMMAND, event)
      },
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      event => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false
        const anchorNode = selection.anchor.getNode()
        if (!$isSelectionInCode(selection)) return false
        if (
          selection.isCollapsed() &&
          selection.anchor.offset === anchorNode.getTextContentSize() &&
          anchorNode.getNextSibling() === null &&
          $isCodeNode(anchorNode.getParentOrThrow())
        ) {
          event.preventDefault()
          return true
        }
        return $handleShiftLines(KEY_ARROW_DOWN_COMMAND, event)
      },
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand(MOVE_TO_START, event => $handleMoveTo(MOVE_TO_START, event), COMMAND_PRIORITY_LOW),
    editor.registerCommand(MOVE_TO_END, event => $handleMoveTo(MOVE_TO_END, event), COMMAND_PRIORITY_LOW)
  )

  return mergeRegister(...registrations)
}
