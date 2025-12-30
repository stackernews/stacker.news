import { $getRoot } from 'lexical'
import { removeZeroWidthSpace } from '@/lib/lexical/utils/mdast'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'

const TRANSFORMERS = []

/** removes zero-width spaces and trims whitespace */
function cleanMarkdown (str) {
  return removeZeroWidthSpace(str).trim()
}

/** gets the markdown string from the editor */
export function $getMarkdown () {
  const textContent = $convertToMarkdownString(TRANSFORMERS, undefined, true)
  return cleanMarkdown(textContent)
}

export function $isMarkdownEmpty () {
  return $getMarkdown() === ''
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
  $getRoot().selectEnd()
}

/**
 * initializes editor state with markdown,
 * uses @lexical/markdown to do simple handling of newlines and paragraphs
 * @param {string} [initialValue=''] - initial content
 */
export function $setMarkdown (initialValue = '', trimWhitespace = true) {
  const root = $getRoot()
  root.clear()

  const value = trimWhitespace
    ? cleanMarkdown(initialValue)
    : removeZeroWidthSpace(initialValue)

  $convertFromMarkdownString(value, TRANSFORMERS, undefined, true)
  $getRoot().selectEnd()
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
