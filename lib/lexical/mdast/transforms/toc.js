import { SKIP, visit } from 'unist-util-visit'

export function tocTransform (tree) {
  visit(tree, 'paragraph', (node, index, parent) => {
    if (!parent) return
    if (node.children?.length !== 1) return

    const child = node.children[0]
    if (child.type === 'text' && child.value.trim() === '{:toc}') {
      parent.children.splice(index, 1, { type: 'tableOfContents' })
      return [SKIP, index]
    }
  })
}
