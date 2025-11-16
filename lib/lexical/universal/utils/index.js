import { $getRoot, $isRootOrShadowRoot, $createTextNode, $createParagraphNode } from 'lexical'
import { $isMarkdownNode, $createMarkdownNode } from '@/lib/lexical/nodes/core/markdown'
import { $findMatchingParent } from '@lexical/utils'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { $isAtNodeEnd } from '@lexical/selection'

/**
 * gets the selected node from a selection, accounting for selection direction
 * if backward selection, returns the node at the end of the selection
 * if forward selection, returns the node at the start of the selection
 * @param {Object} selection - lexical selection object
 * @returns {Object} selected lexical node
 */
export function getSelectedNode (selection) {
  const anchor = selection.anchor
  const focus = selection.focus
  const anchorNode = anchor.getNode()
  const focusNode = focus.getNode()

  if (anchorNode === focusNode) {
    return anchorNode
  }

  const isBackward = selection.isBackward()
  if (isBackward) {
    return $isAtNodeEnd(focus) ? anchorNode : focusNode
  } else {
    return $isAtNodeEnd(anchor) ? anchorNode : focusNode
  }
}

/**
 * finds the top-level element containing a node
 * @param {Object} node - lexical node
 * @returns {Object} top-level element node
 */
export function $findTopLevelElement (node) {
  let topLevelElement = node.getKey() === 'root'
    ? node
    : $findMatchingParent(node, (e) => {
      const parent = e.getParent()
      return parent !== null && $isRootOrShadowRoot(parent)
    })

  if (topLevelElement === null) {
    topLevelElement = node.getTopLevelElementOrThrow()
  }

  return topLevelElement
}

/** toggles between markdown mode and rich text mode */
export function $toggleMarkdownMode () {
  const root = $getRoot()
  const markdownMode = $isMarkdownMode()
  if (markdownMode) {
    const firstChild = root.getFirstChild()
    // bypass markdown node removal protection
    if (typeof firstChild.bypassProtection === 'function') firstChild.bypassProtection()
    $convertFromMarkdownString(firstChild.getTextContent(), SN_TRANSFORMERS, undefined, false)
  } else {
    const markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, false)
    const codeNode = $createMarkdownNode()
    codeNode.append($createTextNode(markdown))
    root.clear().append(codeNode)
    if (markdown.length === 0) codeNode.select()
  }
}

/**
 * checks if editor is in markdown mode
 * @returns {boolean} true if in markdown mode
 */
export function $isMarkdownMode () {
  const root = $getRoot()
  const firstChild = root.getFirstChild()
  return $isMarkdownNode(firstChild)
}

/**
 * checks if editor root is empty
 * in rich text mode, it checks if children are empty (so it won't return empty if there's just a media node)
 * in markdown mode, it checks if the text content is empty
 * @returns {boolean} true if root has no content
 */
export function $isRootEmpty () {
  const root = $getRoot()
  if (!$isMarkdownMode()) {
    const children = root.getChildren()
    if (children.length === 0) return true
    // check if all children are empty
    return children.every(child => child?.isEmpty?.() ?? false)
  }
  const firstChild = root.getFirstChild()
  return $isMarkdownNode(firstChild) && firstChild.getTextContent().trim() === ''
}

/**
 * initializes editor state with markdown or rich text mode
 * @param {boolean} markdown - whether to use markdown mode
 * @param {Object} editor - lexical editor instance
 * @param {string} [initialValue=''] - initial content
 */
export function $initializeEditorState (markdown, editor, initialValue = '') {
  const node = markdown ? $createMarkdownNode() : $createParagraphNode()
  if (initialValue) {
    if (!markdown) {
      editor.update(() => {
        $convertFromMarkdownString(initialValue, SN_TRANSFORMERS)
      })
    } else {
      node.append($createTextNode(initialValue))
    }
  }
  const root = $getRoot()
  const firstChild = root.getFirstChild()
  // bypass markdown node removal protection, if any
  if (firstChild && typeof firstChild.bypassProtection === 'function') {
    firstChild.bypassProtection()
  }
  root.clear().append(node)
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
