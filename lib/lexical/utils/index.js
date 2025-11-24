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
