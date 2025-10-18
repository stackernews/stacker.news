import { $getRoot, $isRootOrShadowRoot } from 'lexical'
import { $isMarkdownNode, $createMarkdownNode } from '@/lib/lexical/nodes/markdownnode'
import { $findMatchingParent } from '@lexical/utils'
import { $isRootTextContentEmpty } from '@lexical/text'

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

// only in editor reads and updates or commands
export function $isMarkdownMode () {
  const root = $getRoot()
  const firstChild = root.getFirstChild()
  return $isMarkdownNode(firstChild)
}

export function $isRootEmpty () {
  if (!$isMarkdownMode()) return $isRootTextContentEmpty()
  const root = $getRoot()
  const firstChild = root.getFirstChild()
  return $isMarkdownNode(firstChild) && firstChild.getTextContent().trim() === ''
}

export function $initializeMarkdown () {
  const codeNode = $createMarkdownNode()
  const root = $getRoot()
  root.clear().append(codeNode)
}
