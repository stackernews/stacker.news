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

  // double linebreaks create paragraphs
  const paragraphs = initialValue.split('\n\n')

  paragraphs.forEach((paragraphText) => {
    const paragraphNode = $createParagraphNode()
    // single linebreaks create line breaks
    const paragraphTexts = paragraphText.split('\n')
    paragraphTexts.forEach((text, index) => {
      paragraphNode.append($createTextNode(text))
      if (index < paragraphTexts.length - 1) {
        paragraphNode.append($createLineBreakNode())
      }
    })
    root.append(paragraphNode)
  })

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
