import { $getRoot, $getSelection, $isRangeSelection, $createParagraphNode, $isTextNode, $isElementNode, $isParagraphNode, $createTextNode } from 'lexical'
import { removeZeroWidthSpace } from '@/lib/lexical/utils/mdast'

/** removes zero-width spaces and trims whitespace */
function cleanMarkdown (str, trimWhitespace = true) {
  return trimWhitespace
    ? removeZeroWidthSpace(str).trim()
    : removeZeroWidthSpace(str)
}

/** gets the text content of the editor
 *  mimicks $getRoot().getTextContent() with controlled newlines
 */
export function $getMarkdown (trimWhitespace = true) {
  let textContent = ''
  const root = $getRoot()
  const children = root.getChildren()
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    textContent += child.getTextContent()
    if ($isElementNode(child) && i !== children.length - 1 && !child.isInline()) {
      if ($isParagraphNode(child)) {
        textContent += '\n'
      } else {
        textContent += '\n\n'
      }
    }
  }
  return cleanMarkdown(textContent, trimWhitespace)
}

export function $isMarkdownEmpty () {
  return $getMarkdown().trim() === ''
}

/** inserts markdown content at the current selection,
 *  or appends to the root if no selection */
export function $insertMarkdown (markdown) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return $appendMarkdown(markdown)

  const nodes = $getNodesFromMarkdown(markdown)
  selection.insertNodes(nodes)
}

/** appends markdown content to the root */
export function $appendMarkdown (markdown, spacing = 0) {
  const root = $getRoot()
  const nodes = $getNodesFromMarkdown(markdown)
  // if root is not empty but its content is (e.g. empty paragraphs), clear it
  if (!root.isEmpty() && $isMarkdownEmpty()) root.clear()
  root.append(...nodes)

  if (spacing > 0) {
    for (let i = 0; i < spacing; i++) {
      root.append($createParagraphNode())
    }
  }

  root.selectEnd()
}

/** parses plain text content to Lexical Paragraphs */
export function $getNodesFromMarkdown (markdown, trimWhitespace = true) {
  const nodes = []
  const value = cleanMarkdown(markdown, trimWhitespace)

  const lines = value.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') {
      nodes.push($createParagraphNode())
    } else {
      nodes.push($createParagraphNode().append($createTextNode(line)))
    }
  }
  return nodes
}

/**
 * initializes editor state with markdown
 * @param {string} [initialValue=''] - initial content
 */
export function $setMarkdown (initialValue = '', trimWhitespace = true) {
  const root = $getRoot()
  root.clear()
  const nodes = $getNodesFromMarkdown(initialValue, trimWhitespace)
  root.append(...nodes).selectEnd()
}
/**
 * inserts markdown content or TextNode at the current selection with optional spacing
 * @param text - the markdown text or TextNode to insert
 * @param spacing - number of paragraph breaks to add before/after
 * @param forceSpacing - whether to add spacing even without surrounding content
 */
export function $insertTextAtSelection (text, spacing = 0, forceSpacing = false) {
  const root = $getRoot()
  const selection = $getSelection()
  const textNode = $isTextNode(text) ? text : $createTextNode(text)

  if (!$isRangeSelection(selection)) {
    root.append($createParagraphNode().append(textNode))
    return
  }

  const anchorNode = selection.anchor.getNode()
  const anchorOffset = selection.anchor.offset

  // determine if there's content before the cursor
  const hasContentBefore = hasContentBeforeCursor(anchorNode, anchorOffset)

  // determine if there's content after the cursor
  const hasContentAfter = hasContentAfterCursor(anchorNode, anchorOffset)

  // insert leading spacing if needed
  if (hasContentBefore || forceSpacing) {
    insertParagraphs(selection, spacing)
  }

  // insert the markdown content
  selection.insertNodes([$createParagraphNode().append(textNode)])

  // insert trailing spacing if needed
  if (hasContentAfter || forceSpacing) {
    insertParagraphs(selection, spacing)
  }
}

/** removes empty nodes from the start and end of the root */
export function $trimEmptyNodes () {
  const root = $getRoot()
  const children = root.getChildren()

  if (children.length === 0) return

  // first non-empty index
  let startIdx = 0
  while (startIdx < children.length && children[startIdx]?.isEmpty?.()) {
    startIdx++
  }

  // last non-empty index
  let endIdx = children.length - 1
  while (endIdx >= startIdx && children[endIdx]?.isEmpty?.()) {
    endIdx--
  }

  // remove empty nodes at start
  for (let i = 0; i < startIdx; i++) {
    children[i].remove()
  }

  // remove empty nodes at end
  for (let i = children.length - 1; i > endIdx; i--) {
    children[i].remove()
  }
}

/** checks if a sibling node has content */
function hasSiblingContent (sibling) {
  return sibling !== null &&
         !sibling.isEmpty?.() &&
         sibling.getTextContent() !== ''
}

/** checks if there's content before the cursor position */
function hasContentBeforeCursor (node, offset) {
  if (offset > 0) return true
  return hasSiblingContent(node.getPreviousSibling())
}

/** checks if there's content after the cursor position */
function hasContentAfterCursor (node, offset) {
  // if the node is a TextNode, check if the offset is within the text content length
  if ($isTextNode(node)) {
    if (offset < node.getTextContent().length) return true
  // if the node is an ElementNode, check if the offset is within the children size
  } else if ($isElementNode(node)) {
    if (offset < node.getChildrenSize()) return true
  }
  return hasSiblingContent(node.getNextSibling())
}

/** inserts multiple paragraph breaks */
function insertParagraphs (selection, count) {
  for (let i = 0; i < count; i++) {
    selection.insertParagraph()
  }
}
