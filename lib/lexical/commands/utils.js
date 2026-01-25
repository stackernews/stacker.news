import { HeadingNode } from '@lexical/rich-text'
import { $findMatchingParent } from '@lexical/utils'
import { $getEditor, $isRootOrShadowRoot } from 'lexical'

export function $isMarkdownMode () {
  const editor = $getEditor()
  const isMarkdownMode = !editor.hasNodes([HeadingNode])
  return isMarkdownMode
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
