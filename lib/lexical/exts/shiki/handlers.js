import {
  $getSelection,
  $isRangeSelection,
  $isLineBreakNode,
  $isTabNode,
  $createTabNode,
  $createLineBreakNode,
  $createPoint,
  $setSelectionFromCaretRange,
  $getCaretRangeInDirection,
  $getCaretRange,
  $getTextPointCaret,
  $normalizeCaret,
  $getSiblingCaret,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  INSERT_TAB_COMMAND,
  KEY_ARROW_UP_COMMAND,
  MOVE_TO_START
} from 'lexical'
import {
  $isCodeNode,
  $isCodeHighlightNode,
  $getFirstCodeNodeOfLine,
  $getLastCodeNodeOfLine,
  $getCodeLineDirection,
  $getStartOfCodeInLine,
  $getEndOfCodeInLine
} from '@lexical/code-core'
import { $isSelectionInCode } from '@/lib/lexical/exts/shiki/transforms'

// splits the selection into per-line arrays of CodeHighlight/Tab nodes. drops
// empty lines and the trailing line when the selection ends exactly at the
// start of one (i.e. caret sitting at column 0 of the next line).
function $getCodeLines (selection) {
  const nodes = selection.getNodes()
  const lines = []
  if (nodes.length === 1 && $isCodeNode(nodes[0])) return lines
  let lastLine = []
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (!($isCodeHighlightNode(node) || $isTabNode(node) || $isLineBreakNode(node))) {
      throw new Error('Expected selection to be inside CodeBlock and consisting of CodeHighlightNode, TabNode and LineBreakNode')
    }
    if ($isLineBreakNode(node)) {
      if (lastLine.length > 0) {
        lines.push(lastLine)
        lastLine = []
      }
    } else {
      lastLine.push(node)
    }
  }
  if (lastLine.length > 0) {
    const selectionEnd = selection.isBackward() ? selection.anchor : selection.focus
    const lastPoint = $createPoint(lastLine[0].getKey(), 0, 'text')
    if (!selectionEnd.is(lastPoint)) lines.push(lastLine)
  }
  return lines
}

// decides whether Tab (or Shift+Tab) inside a code block should insert a Tab
// character or indent/outdent the surrounding line(s). Returns the command to
// dispatch, or null when we're not in code (so the default Lexical Tab handler
// can take over).
export function $handleTab (shiftKey) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !$isSelectionInCode(selection)) return null
  const indentOrOutdent = !shiftKey ? INDENT_CONTENT_COMMAND : OUTDENT_CONTENT_COMMAND
  const tabOrOutdent = !shiftKey ? INSERT_TAB_COMMAND : OUTDENT_CONTENT_COMMAND
  const { anchor, focus } = selection

  // 1. collapsed selection: insert/outdent
  if (anchor.is(focus)) return tabOrOutdent

  // 2. selection spans multiple lines: indent/outdent
  const codeLines = $getCodeLines(selection)
  if (codeLines.length !== 1) return indentOrOutdent

  const codeLine = codeLines[0]
  if (codeLine.length === 0) {
    throw new Error('$getCodeLines only extracts non-empty lines')
  }
  let selectionFirst
  let selectionLast
  if (selection.isBackward()) {
    selectionFirst = focus
    selectionLast = anchor
  } else {
    selectionFirst = anchor
    selectionLast = focus
  }

  const firstOfLine = $getFirstCodeNodeOfLine(codeLine[0])
  const lastOfLine = $getLastCodeNodeOfLine(codeLine[0])
  const anchorOfLine = $createPoint(firstOfLine.getKey(), 0, 'text')
  const focusOfLine = $createPoint(lastOfLine.getKey(), lastOfLine.getTextContentSize(), 'text')

  // 3. selection starts before the line's first character
  if (selectionFirst.isBefore(anchorOfLine)) return indentOrOutdent
  // 4. selection ends after the line's last character
  if (focusOfLine.isBefore(selectionLast)) return indentOrOutdent
  // 5. partial-line selection: insert tab
  if (anchorOfLine.isBefore(selectionFirst) || selectionLast.isBefore(focusOfLine)) return tabOrOutdent
  // 6. selection matches the whole line: indent
  return indentOrOutdent
}

// handles INDENT_CONTENT_COMMAND / OUTDENT_CONTENT_COMMAND inside code blocks.
// adds or removes a leading TabNode per selected line.
export function $handleMultilineIndent (type) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !$isSelectionInCode(selection)) return false
  const codeLines = $getCodeLines(selection)
  const codeLinesLength = codeLines.length

  // collapsed at line start: insert a tab
  if (codeLinesLength === 0 && selection.isCollapsed()) {
    if (type === INDENT_CONTENT_COMMAND) selection.insertNodes([$createTabNode()])
    return true
  }

  // selection spans only a line break: insert tab then linebreak, place caret
  // between them in the right direction
  if (codeLinesLength === 0 && type === INDENT_CONTENT_COMMAND && selection.getTextContent() === '\n') {
    const tabNode = $createTabNode()
    const lineBreakNode = $createLineBreakNode()
    const direction = selection.isBackward() ? 'previous' : 'next'
    selection.insertNodes([tabNode, lineBreakNode])
    $setSelectionFromCaretRange(
      $getCaretRangeInDirection(
        $getCaretRange(
          $getTextPointCaret(tabNode, 'next', 0),
          $normalizeCaret($getSiblingCaret(lineBreakNode, 'next'))
        ),
        direction
      )
    )
    return true
  }

  for (let i = 0; i < codeLinesLength; i++) {
    const line = codeLines[i]
    if (line.length > 0) {
      let firstOfLine = line[0]
      // for the first line consider the absolute first node even if it's not
      // included in the selection
      if (i === 0) firstOfLine = $getFirstCodeNodeOfLine(firstOfLine)
      if (type === INDENT_CONTENT_COMMAND) {
        const tabNode = $createTabNode()
        firstOfLine.insertBefore(tabNode)
        // patch selection so the boundary endpoint at column 0 follows the new tab
        if (i === 0) {
          const anchorKey = selection.isBackward() ? 'focus' : 'anchor'
          const anchorLine = $createPoint(firstOfLine.getKey(), 0, 'text')
          if (selection[anchorKey].is(anchorLine)) {
            selection[anchorKey].set(tabNode.getKey(), 0, 'text')
          }
        }
      } else if ($isTabNode(firstOfLine)) {
        firstOfLine.remove()
      }
    }
  }
  return true
}

// Alt+Up / Alt+Down shifts the current line (or selected block of lines) up or
// down within the code block. Without Alt, also prevents the caret from
// escaping the code block when it's already at the first/last line and there's
// no sibling outside to move to.
export function $handleShiftLines (type, event) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return false
  // capture anchor/focus before calling getNode() (which can collapse the selection)
  const { anchor, focus } = selection
  const anchorOffset = anchor.offset
  const focusOffset = focus.offset
  const anchorNode = anchor.getNode()
  const focusNode = focus.getNode()
  const arrowIsUp = type === KEY_ARROW_UP_COMMAND

  if (
    !$isSelectionInCode(selection) ||
    !($isCodeHighlightNode(anchorNode) || $isTabNode(anchorNode)) ||
    !($isCodeHighlightNode(focusNode) || $isTabNode(focusNode))
  ) return false

  if (!event.altKey) {
    // collapsed at code-block edge with no native sibling to receive selection
    if (selection.isCollapsed()) {
      const codeNode = anchorNode.getParentOrThrow()
      if (arrowIsUp && anchorOffset === 0 && anchorNode.getPreviousSibling() === null) {
        const codeNodeSibling = codeNode.getPreviousSibling()
        if (codeNodeSibling === null) {
          codeNode.selectPrevious()
          event.preventDefault()
          return true
        }
      } else if (!arrowIsUp && anchorOffset === anchorNode.getTextContentSize() && anchorNode.getNextSibling() === null) {
        const codeNodeSibling = codeNode.getNextSibling()
        if (codeNodeSibling === null) {
          codeNode.selectNext()
          event.preventDefault()
          return true
        }
      }
    }
    return false
  }

  let start
  let end
  if (anchorNode.isBefore(focusNode)) {
    start = $getFirstCodeNodeOfLine(anchorNode)
    end = $getLastCodeNodeOfLine(focusNode)
  } else {
    start = $getFirstCodeNodeOfLine(focusNode)
    end = $getLastCodeNodeOfLine(anchorNode)
  }
  if (start == null || end == null) return false

  const range = start.getNodesBetween(end)
  for (let i = 0; i < range.length; i++) {
    const node = range[i]
    if (!$isCodeHighlightNode(node) && !$isTabNode(node) && !$isLineBreakNode(node)) return false
  }

  // selection is inside the codeblock. Even if we can't actually move the
  // lines (e.g. already at top/bottom), preventDefault to suppress default
  // arrow behavior and stopPropagation to keep Firefox from moving the caret.
  event.preventDefault()
  event.stopPropagation()

  const linebreak = arrowIsUp ? start.getPreviousSibling() : end.getNextSibling()
  if (!$isLineBreakNode(linebreak)) return true
  const sibling = arrowIsUp ? linebreak.getPreviousSibling() : linebreak.getNextSibling()
  if (sibling == null) return true

  const maybeInsertionPoint =
    $isCodeHighlightNode(sibling) || $isTabNode(sibling) || $isLineBreakNode(sibling)
      ? arrowIsUp ? $getFirstCodeNodeOfLine(sibling) : $getLastCodeNodeOfLine(sibling)
      : null
  let insertionPoint = maybeInsertionPoint != null ? maybeInsertionPoint : sibling
  linebreak.remove()
  range.forEach(node => node.remove())
  if (type === KEY_ARROW_UP_COMMAND) {
    range.forEach(node => insertionPoint.insertBefore(node))
    insertionPoint.insertBefore(linebreak)
  } else {
    insertionPoint.insertAfter(linebreak)
    insertionPoint = linebreak
    range.forEach(node => {
      insertionPoint.insertAfter(node)
      insertionPoint = node
    })
  }
  selection.setTextNodeRange(anchorNode, anchorOffset, focusNode, focusOffset)
  return true
}

// Cmd-Left / Cmd-Right (mapped to MOVE_TO_START / MOVE_TO_END) within a code
// line. Skips leading indentation so "go to start" lands at the first non-tab
// character, mimicking what most code editors do.
export function $handleMoveTo (type, event) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return false
  const { anchor, focus } = selection
  const anchorNode = anchor.getNode()
  const focusNode = focus.getNode()
  const isMoveToStart = type === MOVE_TO_START

  if (
    !$isSelectionInCode(selection) ||
    !($isCodeHighlightNode(anchorNode) || $isTabNode(anchorNode)) ||
    !($isCodeHighlightNode(focusNode) || $isTabNode(focusNode))
  ) return false

  const focusLineNode = focusNode
  const direction = $getCodeLineDirection(focusLineNode)
  const moveToStart = direction === 'rtl' ? !isMoveToStart : isMoveToStart

  if (moveToStart) {
    const start = $getStartOfCodeInLine(focusLineNode, focus.offset)
    if (start !== null) {
      const { node, offset } = start
      if ($isLineBreakNode(node)) {
        node.selectNext(0, 0)
      } else {
        selection.setTextNodeRange(node, offset, node, offset)
      }
    } else {
      focusLineNode.getParentOrThrow().selectStart()
    }
  } else {
    const node = $getEndOfCodeInLine(focusLineNode)
    node.select()
  }
  event.preventDefault()
  event.stopPropagation()
  return true
}
