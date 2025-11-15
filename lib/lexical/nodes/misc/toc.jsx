import { DecoratorNode, $applyNodeReplacement, $getRoot } from 'lexical'
import { $isSNHeadingNode } from '@/lib/lexical/nodes/misc/heading'

// extract headings from root node
function $extractHeadingsFromRoot () {
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
function buildHtmlFromStructure (items) {
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

function $convertTableOfContentsElement (domNode) {
  if (domNode.hasAttribute('data-lexical-toc')) {
    const node = $createTableOfContentsNode()
    return { node }
  }
  return null
}

export class TableOfContentsNode extends DecoratorNode {
  static getType () {
    return 'table-of-contents'
  }

  static clone (node) {
    return new TableOfContentsNode(node.__key)
  }

  static importJSON (serializedNode) {
    return $createTableOfContentsNode()
  }

  exportJSON () {
    return {
      type: 'table-of-contents',
      version: 1
    }
  }

  createDOM (config) {
    const domNode = document.createElement('div')
    domNode.setAttribute('data-lexical-toc', 'true')
    return domNode
  }

  exportDOM (editor) {
    return editor.getEditorState().read(() => {
      const div = document.createElement('div')
      div.setAttribute('data-lexical-toc', 'true')
      const details = document.createElement('details')
      details.setAttribute('class', 'sn__collapsible sn__toc')

      const summary = document.createElement('summary')
      summary.setAttribute('class', 'sn__collapsible__header')
      summary.textContent = 'table of contents'
      details.appendChild(summary)

      const headings = $extractHeadingsFromRoot()
      const structure = buildNestedTocStructure(headings)

      if (structure.length === 0) {
        const emptyDiv = document.createElement('div')
        emptyDiv.setAttribute('class', 'text-muted fst-italic')
        emptyDiv.textContent = 'No headings found'
        details.appendChild(emptyDiv)
        return { element: details }
      }

      const tocList = buildHtmlFromStructure(structure)
      details.appendChild(tocList)
      div.appendChild(details)
      return { element: div }
    })
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-toc')) return null
        return { conversion: $convertTableOfContentsElement, priority: 1 }
      },
      details: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-toc')) return null
        return { conversion: $convertTableOfContentsElement, priority: 1 }
      },
      nav: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-toc')) return null
        return { conversion: $convertTableOfContentsElement, priority: 1 }
      }
    }
  }

  updateDOM () {
    return false
  }

  isInline () {
    return false
  }

  isSelectable () {
    return true
  }

  isIsolated () {
    return true
  }

  decorate (editor) {
    const { TableOfContents } = require('@/components/lexical/plugins/decorative/toc')
    const headings = $extractHeadingsFromRoot()
    return <TableOfContents headings={headings} />
  }
}

export function $createTableOfContentsNode () {
  return $applyNodeReplacement(new TableOfContentsNode())
}

export function $isTableOfContentsNode (node) {
  return node instanceof TableOfContentsNode
}
