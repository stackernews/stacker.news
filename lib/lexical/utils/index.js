import { $getRoot } from 'lexical'
import { removeZeroWidthSpace } from '@/lib/lexical/utils/mdast'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'

const TRANSFORMERS = []

/** gets the markdown string from the editor */
export function $getMarkdown () {
  const textContent = $convertToMarkdownString(TRANSFORMERS, undefined, true)
  // remove trailing and leading whitespace and zero-width spaces
  return removeZeroWidthSpace(textContent).trim()
}

export function $isMarkdownEmpty () {
  return $getMarkdown().trim() === ''
}

export function $appendMarkdown (markdown) {
  // add trailing newlines to allow for user input
  const appendValue = removeZeroWidthSpace(markdown).trim() + '\n\n'
  if (appendValue === '') return

  const currentContent = $getMarkdown()
  if (currentContent === '') {
    $setMarkdown(appendValue, false)
    return
  }

  // add separator between current content and append value
  const newContent = currentContent + '\n\n' + appendValue
  $convertFromMarkdownString(newContent, TRANSFORMERS, undefined, true)
}

/**
 * initializes editor state with markdown,
 * uses @lexical/markdown to do simple handling of newlines and paragraphs
 * @param {string} [initialValue=''] - initial content
 */
export function $setMarkdown (initialValue = '', trimTrailingNewline = true) {
  const root = $getRoot()
  root.clear()

  // remove trailing and leading whitespace and zero-width spaces
  let value = removeZeroWidthSpace(initialValue)
  if (trimTrailingNewline) {
    value = value.trimEnd()
  }

  $convertFromMarkdownString(value, TRANSFORMERS, undefined, true)
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
