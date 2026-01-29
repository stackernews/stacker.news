import { HeadingNode } from '@lexical/rich-text'
import { $findMatchingParent } from '@lexical/utils'
import { $getEditor, $isRootOrShadowRoot, $getSelection, $createRangeSelection, $setSelection } from 'lexical'

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

/**
 * helper to check if a node is a valid non-empty paragraph
 */
function $isValidParagraph (node) {
  return node && node.getType() === 'paragraph' && node.getTextContent().trim().length > 0
}

/**
 * collects consecutive valid paragraphs in a given direction
 */
function $collectSiblings (startNode, getNextSibling) {
  const siblings = []
  let sibling = getNextSibling(startNode)
  while ($isValidParagraph(sibling)) {
    siblings.push(sibling)
    sibling = getNextSibling(sibling)
  }
  return siblings
}

/**
 * selects all consecutive non-empty paragraphs in the current selection
 *
 * in markdown mode every line is a paragraph, and to get a real paragraph selection,
 * we need to collect all consecutive non-empty paragraphs.
 */
export function $selectConsecutiveParagraphs () {
  const selection = $getSelection()
  if (!selection || !selection.isCollapsed()) return null

  const anchorNode = selection.anchor.getNode()
  const currentParagraph = $findMatchingParent(anchorNode, (node) => node.getType() === 'paragraph')
  if (!currentParagraph) return

  // collect all consecutive non-empty paragraphs
  const prevParagraphs = $collectSiblings(currentParagraph, (node) => node.getPreviousSibling()).reverse()
  const nextParagraphs = $collectSiblings(currentParagraph, (node) => node.getNextSibling())
  const paragraphs = [...prevParagraphs, currentParagraph, ...nextParagraphs]

  if (paragraphs.length === 0) return

  // create selection spanning all paragraphs
  const firstParagraph = paragraphs[0]
  const lastParagraph = paragraphs[paragraphs.length - 1]

  const rangeSelection = $createRangeSelection()
  rangeSelection.anchor.set(firstParagraph.getKey(), 0, 'element')
  rangeSelection.focus.set(lastParagraph.getKey(), lastParagraph.getChildrenSize(), 'element')
  $setSelection(rangeSelection)
}
