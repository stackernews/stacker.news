import { $getRoot, $isRootOrShadowRoot, $createTextNode, $createParagraphNode } from 'lexical'
import { $isMarkdownNode, $createMarkdownNode } from '@/lib/lexical/nodes/core/markdown'
import { $findMatchingParent } from '@lexical/utils'
import { $isRootTextContentEmpty } from '@lexical/text'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'

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
  if (!$isMarkdownMode()) {
    const root = $getRoot()
    const children = root.getChildren()
    return children.length === 0 || (children.length === 1 && $isRootTextContentEmpty())
  }
  const root = $getRoot()
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
