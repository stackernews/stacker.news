import { $getRoot } from 'lexical'
import { $isSNHeadingNode } from '@/lib/lexical/nodes/misc/heading'

// extract headings from root node
export function $extractHeadingsFromRoot () {
  const headings = []
  const root = $getRoot()

  const extractHeadings = (node) => {
    const children = node.getChildren()
    for (const child of children) {
      if ($isSNHeadingNode(child)) {
        const text = child.getTextContent()
        const depth = parseInt(child.getTag().substring(1)) // h1 -> 1, h2 -> 2, etc.
        const headingSlug = child.getSlug()
        headings.push({ text, depth, slug: headingSlug })
      }
      // recursively check children
      if (child.getChildrenSize && child.getChildrenSize() > 0) {
        extractHeadings(child)
      }
    }
  }

  extractHeadings(root)
  return headings
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
