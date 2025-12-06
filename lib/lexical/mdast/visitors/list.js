import { $createListNode, $createListItemNode, $isListNode, $isListItemNode } from '@lexical/list'

// mdast -> lexical: list
export const MdastListVisitor = {
  testNode: 'list',
  visitNode ({ mdastNode, actions }) {
    const hasChecks = mdastNode.children.some((item) => typeof item.checked === 'boolean')
    const listType = hasChecks ? 'check' : mdastNode.ordered ? 'number' : 'bullet'
    // preserve list start number for ordered lists
    const start = mdastNode.ordered ? (mdastNode.start ?? 1) : undefined
    actions.addAndStepInto($createListNode(listType, start))
  }
}

// mdast -> lexical: list item
export const MdastListItemVisitor = {
  testNode: 'listItem',
  visitNode ({ mdastNode, actions }) {
    const listItemNode = $createListItemNode(
      typeof mdastNode.checked === 'boolean' ? mdastNode.checked : undefined
    )
    actions.addAndStepInto(listItemNode)
  }
}

// lexical -> mdast: list
export const LexicalListVisitor = {
  testLexicalNode: $isListNode,
  visitLexicalNode ({ lexicalNode, actions }) {
    const listType = lexicalNode.getListType()
    const isOrdered = listType === 'number'
    actions.addAndStepInto('list', {
      ordered: isOrdered,
      start: lexicalNode.getStart(),
      spread: false
    })
  }
}

// lexical -> mdast: list item
export const LexicalListItemVisitor = {
  testLexicalNode: $isListItemNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    const children = lexicalNode.getChildren()
    const firstChild = children[0]

    // handle nested lists
    if (children.length === 1 && $isListNode(firstChild)) {
      const prevListItem = mdastParent.children.at(-1)
      if (prevListItem) {
        actions.visitChildren(lexicalNode, prevListItem)
      } else {
        actions.visitChildren(firstChild, mdastParent)
      }
      return
    }

    // get parent list type for checkbox status
    const parentList = lexicalNode.getParent()
    const isCheckList = $isListNode(parentList) && parentList.getListType() === 'check'

    const listItem = {
      type: 'listItem',
      spread: false,
      checked: isCheckList ? Boolean(lexicalNode.getChecked()) : undefined,
      children: []
    }

    actions.appendToParent(mdastParent, listItem)

    // wrap inline content in paragraph
    let paragraph = null
    children.forEach((child) => {
      if ($isListNode(child)) {
        paragraph = null
        actions.visit(child, listItem)
      } else {
        if (!paragraph) {
          paragraph = { type: 'paragraph', children: [] }
          listItem.children.push(paragraph)
        }
        actions.visit(child, paragraph)
      }
    })
  }
}
