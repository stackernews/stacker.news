import { $isElementNode } from 'lexical'

/**
 * checks if a node is a parent node
 * @param {Object} node - mdast node
 * @returns {boolean} true if node is a parent node
 */
export function isParent (node) {
  return Array.isArray(node?.children)
}

/**
 * checks if a node is a block element
 * @param {Object} node - lexical node
 * @returns {boolean} true if node is a block element
 */
export function isBlockElement (node) {
  return $isElementNode(node) && !node.isInline()
}
