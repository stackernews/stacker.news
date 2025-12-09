import { visit, SKIP } from 'unist-util-visit'

// add backref node to the footnote definition
function addBackref (node) {
  const backref = {
    type: 'footnoteBackref',
    identifier: node.identifier
  }

  if (!node.children || node.children.length === 0) {
    node.children = [{
      type: 'paragraph',
      children: [backref]
    }]
    return
  }

  const lastChild = node.children[node.children.length - 1]

  if (lastChild.children) {
    lastChild.children.push(backref)
  } else {
    node.children.push({
      type: 'paragraph',
      children: [backref]
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
      // if the footnote definition is referenced, add it to the defs array
      if (refIds.has(node.identifier)) {
        // add backref link node to the footnote definition
        addBackref(node)
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
