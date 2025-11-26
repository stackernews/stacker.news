import { $getRoot, $createTextNode, $createParagraphNode } from 'lexical'

export function $getMarkdown () {
  return $getRoot().getTextContent()
}

export function $setMarkdown (editor, markdown) {
  $initializeEditorState(editor, markdown)
}

export function $isMarkdownEmpty () {
  return $getMarkdown().trim() === ''
}

/**
 * initializes editor state with markdown or rich text mode
 * @param {boolean} markdown - whether to use markdown mode
 * @param {Object} editor - lexical editor instance
 * @param {string} [initialValue=''] - initial content
 */
export function $initializeEditorState (editor, initialValue = '') {
  const root = $getRoot()
  root
    .clear()
    .append($createParagraphNode()
      .append($createTextNode(initialValue))).selectEnd()
  // markdown transformations
  // root.clear().append(...fromMdast(mdast))
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
