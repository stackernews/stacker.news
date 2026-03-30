import { SNHeadingNode } from '@/lib/lexical/nodes/misc/heading'
import { $nodesOfType } from 'lexical'

// extract headings from root node
export function $extractHeadingsFromRoot () {
  return $nodesOfType(SNHeadingNode).map(node => ({
    text: node.getTextContent(),
    depth: parseInt(node.getTag().substring(1)),
    slug: node.getSlug()
  }))
}

// builds nested data structure from flat headings array
export function buildNestedTocStructure (headings) {
  if (headings.length === 0) return []

  const items = []
  const stack = []

  for (const heading of headings) {
    // pop stack until we find appropriate parent level
    while (stack.length > 0 && heading.depth <= stack[stack.length - 1].depth) {
      stack.pop()
    }

    const item = { ...heading, children: [] }

    if (stack.length === 0) {
      items.push(item)
    } else {
      stack[stack.length - 1].children.push(item)
    }

    stack.push(item)
  }

  return items
}

// converts nested structure to DOM elements recursively
export function buildHtmlFromStructure (items) {
  const ul = document.createElement('ul')

  for (const item of items) {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.setAttribute('href', `#${item.slug}`)
    a.textContent = item.text
    li.appendChild(a)

    if (item.children.length > 0) {
      li.appendChild(buildHtmlFromStructure(item.children))
    }

    ul.appendChild(li)
  }

  return ul
}
