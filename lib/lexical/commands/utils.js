import { $findMatchingParent } from '@lexical/utils'
import { $isAtNodeEnd } from '@lexical/selection'
import { $isRootOrShadowRoot, $getSelection, $createRangeSelection, $setSelection, $isRangeSelection } from 'lexical'

/**
 * checks if the editor is in markdown mode by checking the namespace of the given editor
 *
 * @param {Object} editor - lexical editor instance
 * @returns {boolean} true if the editor is in markdown mode
 */
export function isMarkdownMode (editor) {
  // XXX
  // we're reading a private property as there's no other clear way to check the namespace
  // whenever it'll be possible, we need to switch to a safer way to do this
  const namespace = editor._config.namespace
  return namespace === 'sn-markdown'
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
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null

  const anchorNode = selection.anchor.getNode()
  const currentParagraph = $findMatchingParent(anchorNode, (node) => node.getType() === 'paragraph')
  if (!currentParagraph) return

  // collect all consecutive non-empty paragraphs
  const prevParagraphs = $collectSiblings(currentParagraph, (node) => node.getPreviousSibling()).reverse()
  const nextParagraphs = $collectSiblings(currentParagraph, (node) => node.getNextSibling())
  const paragraphs = [...prevParagraphs, currentParagraph, ...nextParagraphs]

  // create selection spanning all paragraphs
  const firstParagraph = paragraphs[0]
  const lastParagraph = paragraphs[paragraphs.length - 1]

  const rangeSelection = $createRangeSelection()
  rangeSelection.anchor.set(firstParagraph.getKey(), 0, 'element')
  rangeSelection.focus.set(lastParagraph.getKey(), lastParagraph.getChildrenSize(), 'element')
  $setSelection(rangeSelection)
}

/**
 * gets the selected node from a selection, accounting for selection direction
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
