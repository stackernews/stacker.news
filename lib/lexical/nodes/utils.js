import { $createLinkNode } from '@lexical/link'
import { $createTextNode, $createParagraphNode, $isElementNode, $isDecoratorNode, $isParagraphNode, $isLineBreakNode, $splitNode, $createRangeSelection, $setSelection, $isRootNode } from 'lexical'
import { getLinkAttributes } from '@/lib/url'

export function $replaceNodeWithLink (node, url) {
  if (!node) return

  const parent = node.getParent()
  if (!parent) return

  const { target, rel } = getLinkAttributes(url)
  const linkNode = $createLinkNode(url, {
    target,
    rel
  }).append($createTextNode(url))

  // If parent is an ElementNode (i.e. can have children), directly replace the original node with the link
  if ($isElementNode(parent) && !$isRootNode(parent)) {
    node.replace(linkNode)
    linkNode.selectEnd()
    return
  }

  // Otherwise, insert a new paragraph either inside root or after the parent
  const newParagraph = $createParagraphNode().append(linkNode)
  // remove the original media node
  node.remove()
  if (parent.getType() === 'root') {
    parent.append(newParagraph)
  } else {
    parent.insertAfter(newParagraph)
    // clean up empty parent nodes
    if (parent.getChildrenSize() === 0) {
      parent.remove()
    }
  }
}

export function $isUnwritable (node) {
  if ($isDecoratorNode(node) && !node.isInline()) return true
  if ($isElementNode(node)) {
    const children = node.getChildren()
    return children.length > 0 && children.every($isUnwritable)
  }
  return false
}

export function $splitParagraphsByLineBreaks (selection) {
  const blocks = new Set()
  // collect every paragraph touched by the selection so each one can be normalized.
  for (const node of selection.getNodes()) {
    const block = $isParagraphNode(node) ? node : $findParagraphParent(node)
    if (block !== null) {
      blocks.add(block)
    }
  }
  // also include the anchor/focus containers because getNodes() can miss edge parents.
  for (const point of [selection.anchor, selection.focus]) {
    const block = $findParagraphParent(point.getNode())
    if (block !== null) {
      blocks.add(block)
    }
  }

  // preserve the logical selection before mutating the tree.
  const anchorKey = selection.anchor.key
  const anchorOffset = selection.anchor.offset
  const anchorType = selection.anchor.type
  const focusKey = selection.focus.key
  const focusOffset = selection.focus.offset
  const focusType = selection.focus.type

  for (const block of blocks) {
    const children = block.getChildren()
    const lbIndices = []
    for (let i = 0; i < children.length; i++) {
      if ($isLineBreakNode(children[i])) {
        lbIndices.push(i)
      }
    }
    if (lbIndices.length === 0) {
      continue
    }
    // split from right to left so earlier child indexes stay valid.
    for (let j = lbIndices.length - 1; j >= 0; j--) {
      const [, rightBlock] = $splitNode(block, lbIndices[j])
      // the split leaves the line break at the start of the new block; remove it.
      const firstChild = rightBlock.getFirstChild()
      if ($isLineBreakNode(firstChild)) {
        firstChild.remove()
      }
    }
  }

  // recreate the selection so Lexical keeps the cursor/range after the splits.
  const newSelection = $createRangeSelection()
  newSelection.anchor.set(anchorKey, anchorOffset, anchorType)
  newSelection.focus.set(focusKey, focusOffset, focusType)
  $setSelection(newSelection)
}

function $findParagraphParent (node) {
  if ($isParagraphNode(node)) {
    return node
  }
  const parent = node.getParent()
  return $isElementNode(parent) && $isParagraphNode(parent) ? parent : null
}

// DEBUG: export a node to a JSON object
export function $debugNodeToJSON (node, depth = 0) {
  const json = node.exportJSON()
  const result = { ...json }
  if ($isElementNode(node)) {
    result.children = node.getChildren().map(child => $debugNodeToJSON(child, depth + 1))
  }
  return result
}
