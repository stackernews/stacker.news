import { $getRoot, $getSelection, $isRangeSelection, $createParagraphNode, $isTextNode, $isElementNode } from 'lexical'
import { removeZeroWidthSpace } from '@/lib/lexical/utils/mdast'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'

const TRANSFORMERS = []

/** removes zero-width spaces and trims whitespace */
function cleanMarkdown (str, trimWhitespace = true) {
  return trimWhitespace
    ? removeZeroWidthSpace(str).trim()
    : removeZeroWidthSpace(str)
}

/** gets the markdown string from the editor */
export function $getMarkdown () {
  const textContent = $convertToMarkdownString(TRANSFORMERS, undefined, true)
  return cleanMarkdown(textContent)
}

export function $isMarkdownEmpty () {
  return $getMarkdown().trim() === ''
}

export function $appendMarkdown (markdown) {
  const cleanedInput = cleanMarkdown(markdown)
  if (cleanedInput === '') return

  const currentContent = $getMarkdown()
  if (currentContent === '') {
    $setMarkdown(cleanedInput + '\n\n', false)
    return
  }

  // add separator between current content and append value with trailing newlines
  const newContent = currentContent + '\n\n' + cleanedInput + '\n\n'
  $convertFromMarkdownString(newContent, TRANSFORMERS, undefined, true)
}

/**
 * initializes editor state with markdown,
 * uses @lexical/markdown to do simple handling of newlines and paragraphs
 * @param {string} [initialValue=''] - initial content
 */
export function $setMarkdown (initialValue = '', trimWhitespace = true) {
  const root = $getRoot()
  root.clear()

  const value = cleanMarkdown(initialValue, trimWhitespace)

  $convertFromMarkdownString(value, TRANSFORMERS, undefined, true)
}
/**
 * inserts markdown content or TextNode at the current selection with optional spacing
 * @param {string} text - the markdown text or TextNode to insert
 * @param {number} spacing - number of paragraph breaks to add before/after
 * @param {boolean} forceSpacing - whether to add spacing even without surrounding content
 */
export function $insertTextAtSelection (text, spacing = 0, forceSpacing = false) {
  const root = $getRoot()
  const selection = $getSelection()

  if (!$isRangeSelection(selection)) {
    root.append($createParagraphNode().append(text))
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
  selection.insertNodes([$createParagraphNode().append(text)])

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
