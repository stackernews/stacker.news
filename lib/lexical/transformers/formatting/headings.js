import { $createSNHeadingNode, $isSNHeadingNode, SNHeadingNode } from '../../nodes/misc/heading'

// overrides HEADING transformer to use SNHeadingNode
export const HEADING = {
  dependencies: [SNHeadingNode],
  export: (node, exportChildren) => {
    if (!$isSNHeadingNode(node)) {
      return null
    }
    const level = Number(node.getTag().slice(1))
    return '#'.repeat(level) + ' ' + exportChildren(node)
  },
  regExp: /^(#{1,6})\s/,
  replace: (parentNode, children, match, isImport) => {
    const tag = 'h' + match[1].length
    const headingNode = $createSNHeadingNode(tag)
    headingNode.append(...children)
    parentNode.replace(headingNode)
    if (!isImport) {
      headingNode.select(0, 0)
    }
    return headingNode
  },
  type: 'element'
}
