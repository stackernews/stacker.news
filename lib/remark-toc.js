import { SKIP, visit } from 'unist-util-visit'
import { extractHeadings } from './toc'

export default function remarkToc () {
  return function transformer (tree) {
    const headings = extractHeadings(tree)

    visit(tree, 'paragraph', (node, index, parent) => {
      if (
        node.children?.length === 1 &&
        node.children[0].type === 'text' &&
        node.children[0].value.trim() === '{:toc}'
      ) {
        parent.children.splice(index, 1, buildToc(headings))
        return [SKIP, index]
      }
    })
  }
}

function buildToc (headings) {
  const root = { type: 'list', ordered: false, spread: false, children: [] }
  const stack = [{ depth: 0, node: root }] // holds the current chain of parents

  for (const { heading, slug, depth } of headings) {
    // walk up the stack to find the parent of the current heading
    while (stack.length && depth <= stack[stack.length - 1].depth) {
      stack.pop()
    }
    let parent = stack[stack.length - 1].node

    // if the parent is a li, gets its child ul
    if (parent.type === 'listItem') {
      let ul = parent.children.find(c => c.type === 'list')
      if (!ul) {
        ul = { type: 'list', ordered: false, spread: false, children: [] }
        parent.children.push(ul)
      }
      parent = ul
    }

    // build the li from the current heading
    const listItem = {
      type: 'listItem',
      spread: false,
      children: [{
        type: 'paragraph',
        children: [{
          type: 'link',
          url: `#${slug}`,
          children: [{ type: 'text', value: heading }]
        }]
      }]
    }

    parent.children.push(listItem)
    stack.push({ depth, node: listItem })
  }

  return root
}
