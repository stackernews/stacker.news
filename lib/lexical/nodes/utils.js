import { $createLinkNode } from '@lexical/link'
import { $createTextNode, $createParagraphNode, $isElementNode } from 'lexical'
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

  // If parent is a paragraph, directly replace the media node with the link
  if (parent.getType() === 'paragraph') {
    node.replace(linkNode)
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

// DEBUG: export a node to a JSON object
export function $debugNodeToJSON (node, depth = 0) {
  const json = node.exportJSON()
  const result = { ...json }
  if ($isElementNode(node)) {
    result.children = node.getChildren().map(child => $debugNodeToJSON(child, depth + 1))
  }
  return result
}
