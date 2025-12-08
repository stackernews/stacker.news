/**
 * checks if a node is a parent node
 * @param {Object} node - mdast node
 * @returns {boolean} true if node is a parent node
 */
export function isParent (node) {
  return node.children instanceof Array && node.children.length > 0
}
