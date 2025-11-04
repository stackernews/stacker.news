import { $getRoot, $isRootOrShadowRoot, $createTextNode, $createParagraphNode } from 'lexical'
import { $isMarkdownNode, $createMarkdownNode } from '@/lib/lexical/nodes/core/markdown'
import { $findMatchingParent } from '@lexical/utils'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { $isAtNodeEnd } from '@lexical/selection'

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

export function $toggleMarkdownMode () {
  const root = $getRoot()
  const markdownMode = $isMarkdownMode()
  if (markdownMode) {
    const firstChild = root.getFirstChild()
    // bypass markdown node removal protection
    if (typeof firstChild.bypassProtection === 'function') firstChild.bypassProtection()
    $convertFromMarkdownString(firstChild.getTextContent(), SN_TRANSFORMERS, undefined, true)
  } else {
    const markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
    const codeNode = $createMarkdownNode()
    codeNode.append($createTextNode(markdown))
    root.clear().append(codeNode)
    if (markdown.length === 0) codeNode.select()
  }
}

// only in editor reads and updates or commands
export function $isMarkdownMode () {
  const root = $getRoot()
  const firstChild = root.getFirstChild()
  return $isMarkdownNode(firstChild)
}

export function $isRootEmpty () {
  const root = $getRoot()
  if (!$isMarkdownMode()) {
    const children = root.getChildren()
    if (children.length === 0) return true
    // check if all children are empty
    return children.every(child => child.isEmpty())
  }
  const firstChild = root.getFirstChild()
  return $isMarkdownNode(firstChild) && firstChild.getTextContent().trim() === ''
}

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

export function $trimEmptyNodes () {
  const root = $getRoot()
  const children = root.getChildren()

  if (children.length === 0) return

  // first non-empty index
  let startIdx = 0
  while (startIdx < children.length && children[startIdx].isEmpty()) {
    startIdx++
  }

  // last non-empty index
  let endIdx = children.length - 1
  while (endIdx >= startIdx && children[endIdx].isEmpty()) {
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
