import { $getRoot, $createTextNode, $createParagraphNode, $createLineBreakNode } from 'lexical'
import { removeZeroWidthSpace } from '@/lib/lexical/utils/mdast'

export function $getMarkdown () {
  const textContent = $getRoot().getTextContent()
  return removeZeroWidthSpace(textContent)
}

export function $setMarkdown (markdown) {
  $initializeEditorState(markdown)
}

export function $isMarkdownEmpty () {
  return $getMarkdown().trim() === ''
}

/**
 * initializes editor state with markdown
 * @param {string} [initialValue=''] - initial content
 */
export function $initializeEditorState (initialValue = '') {
  const root = $getRoot()
  root.clear()

  // remove trailing newline
  const content = initialValue.replace(/\n$/, '')

  // split by newlines and create text nodes with line breaks between them
  const lines = content.split('\n')

  const paragraph = $createParagraphNode()
  lines.forEach((line, index) => {
    if (line) {
      paragraph.append($createTextNode(line))
    }
    if (index < lines.length - 1) {
      paragraph.append($createLineBreakNode())
    }
  })
  root.append(paragraph)
  root.selectEnd()
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
