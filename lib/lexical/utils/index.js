import { $getRoot } from 'lexical'
import { removeZeroWidthSpace } from '@/lib/lexical/utils/mdast'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'

/** gets the markdown string from the editor */
export function $getMarkdown () {
  const textContent = $convertToMarkdownString(undefined, undefined, true)
  // remove trailing and leading whitespace and zero-width spaces
  return removeZeroWidthSpace(textContent).trim()
}

export function $isMarkdownEmpty () {
  return $getMarkdown().trim() === ''
}

/**
 * initializes editor state with markdown,
 * uses @lexical/markdown to do simple handling of newlines and paragraphs
 * @param {string} [initialValue=''] - initial content
 */
export function $setMarkdown (initialValue = '') {
  const root = $getRoot()
  root.clear()

  // remove trailing and leading whitespace and zero-width spaces
  const value = removeZeroWidthSpace(initialValue).trim()

  $convertFromMarkdownString(value, undefined, undefined, true)
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
