/**
 * checks if a node is a parent node
 * @param {Object} node - mdast node
 * @returns {boolean} true if node is a parent node
 */
export function isParent (node) {
  return Array.isArray(node?.children)
}

/**
 * checks if a node is a link whose sole child is an image
 * @param {Object} node - mdast node
 * @returns {boolean} true if node is a link wrapping only an image
 */
export function isImageOnlyLink (node) {
  return node?.type === 'link' && node.children?.length === 1 && node.children[0].type === 'image'
}
