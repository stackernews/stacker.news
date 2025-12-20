import { $getRoot, $createTextNode, $createParagraphNode, $createLineBreakNode } from 'lexical'

export function $getMarkdown () {
  return $getRoot().getTextContent()
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

  // remove trailing \n and split by newlines
  const lines = initialValue.replace(/\n+$/, '').split('\n')

  const paragraph = $createParagraphNode()
  lines.forEach((line, i) => {
    paragraph.append($createTextNode(line))
    // add line break between lines
    if (i < lines.length - 1) {
      paragraph.append($createLineBreakNode())
    }
  })
  root.append(paragraph).selectEnd()
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
