import { $createListNode, $createListItemNode, $isListNode, $isListItemNode } from '@lexical/list'

// mdast -> lexical: list
export const MdastListVisitor = {
  testNode: 'list',
  visitNode ({ mdastNode, actions }) {
    const hasChecks = mdastNode.children.some((item) => typeof item.checked === 'boolean')
    const listType = hasChecks ? 'check' : mdastNode.ordered ? 'number' : 'bullet'
    const start = mdastNode.ordered ? (mdastNode.start ?? 1) : 1
    actions.addAndStepInto($createListNode(listType, start))
  }
}

// mdast -> lexical: list item
export const MdastListItemVisitor = {
  testNode: 'listItem',
  visitNode ({ mdastNode, actions }) {
    const checked = typeof mdastNode.checked === 'boolean' ? mdastNode.checked : null
    const listItemNode = $createListItemNode(checked)
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

const isBlockNode = (node) => typeof node.isInline === 'function' && !node.isInline()

const isNestedListOnly = (children) => children.length === 1 && $isListNode(children[0])

const visitNestedListOnly = ({ lexicalNode, mdastParent, actions }) => {
  const prevListItem = mdastParent.children.at(-1)
  if (prevListItem) {
    actions.visitChildren(lexicalNode, prevListItem)
    return
  }
  actions.visitChildren(lexicalNode.getFirstChild(), mdastParent)
}

const isParentCheckList = (lexicalNode) => {
  const parentList = lexicalNode.getParent()
  return $isListNode(parentList) && parentList.getListType() === 'check'
}

const createListItemNode = ({ lexicalNode, children }) => ({
  type: 'listItem',
  spread: children.some(isBlockNode),
  checked: isParentCheckList(lexicalNode) ? Boolean(lexicalNode.getChecked()) : null,
  children: []
})

const wrapInlineContent = ({ children, listItem, actions }) => {
  let paragraph = null
  children.forEach((child) => {
    if (isBlockNode(child)) {
      paragraph = null
      actions.visit(child, listItem)
      return
    }
    if (!paragraph) {
      paragraph = { type: 'paragraph', children: [] }
      listItem.children.push(paragraph)
    }
    actions.visit(child, paragraph)
  })
}

// lexical -> mdast: list item
export const LexicalListItemVisitor = {
  testLexicalNode: $isListItemNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    const children = lexicalNode.getChildren()

    if (isNestedListOnly(children)) {
      visitNestedListOnly({ lexicalNode, mdastParent, actions })
      return
    }

    const listItem = createListItemNode({ lexicalNode, children })
    actions.appendToParent(mdastParent, listItem)
    wrapInlineContent({ children, listItem, actions })
  }
}
