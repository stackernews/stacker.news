import { visit, SKIP } from 'unist-util-visit'

// create backref link
function createBackrefLink (identifier) {
  return {
    type: 'link',
    url: `#fnref-${identifier}`,
    target: null,
    rel: null,
    data: {
      hProperties: {
        className: ['sn-footnote-backref'],
        ariaLabel: `back to reference ${identifier}`,
        dataFootnoteBackref: true
      }
    },
    children: [{ type: 'text', value: ' ↩' }]
  }
}

// add backref link to the footnote definition
function addBackref (node) {
  const backrefLink = createBackrefLink(node.identifier)

  if (!node.children || node.children.length === 0) {
    node.children = [{
      type: 'paragraph',
      children: [backrefLink]
    }]
    return
  }

  const lastChild = node.children[node.children.length - 1]

  if (lastChild.children) {
    lastChild.children.push(backrefLink)
  } else {
    node.children.push({
      type: 'paragraph',
      children: [backrefLink]
    })
  }
}

export function footnoteTransform (tree) {
  const refIds = new Set()
  const defs = []

  // collect all footnote reference identifiers
  visit(tree, 'footnoteReference', (node) => {
    refIds.add(node.identifier)
  })

  // collect all footnote definition nodes
  visit(tree, 'footnoteDefinition', (node, index, parent) => {
    if (parent && typeof index === 'number') {
      // add backref link to the footnote definition
      addBackref(node)
      // if the footnote definition is referenced, add it to the defs array
      if (refIds.has(node.identifier)) {
        defs.push(node)
      }
      // remove the original footnote definition from the tree
      parent.children.splice(index, 1)
      return [SKIP, index]
    }
  })

  // sort and add footnote definitions to the tree
  if (defs.length > 0) {
    defs.sort((a, b) => {
      const numA = parseInt(a.identifier, 10)
      const numB = parseInt(b.identifier, 10)
      return (isNaN(numA) || isNaN(numB))
        ? a.identifier.localeCompare(b.identifier)
        : numA - numB
    })

    tree.children.push({
      type: 'footnotesSection',
      children: defs
    })
  }
}
