import { ListNode, ListItemNode, $isListNode, $isListItemNode, $createListNode, $createListItemNode } from '@lexical/list'

// mimicks ORDERED_LIST transformer, re-implementing non-exported functions from lexical
// this is a workaround to allow for parentheses-style lists to be used in the editor
const LIST_INDENT_SIZE = 4

// re-implemented
function getIndent (whitespaces) {
  const tabs = whitespaces.match(/\t/g)
  const spaces = whitespaces.match(/ /g)
  let indent = 0
  if (tabs) {
    indent += tabs.length
  }
  if (spaces) {
    indent += Math.floor(spaces.length / LIST_INDENT_SIZE)
  }
  return indent
}

// re-implemented
const listReplaceParentheses = (listType) => {
  return (parentNode, children, match, isImport) => {
    const previousNode = parentNode.getPreviousSibling()
    const nextNode = parentNode.getNextSibling()
    const listItem = $createListItemNode()

    if ($isListNode(nextNode) && nextNode.getListType() === listType) {
      const firstChild = nextNode.getFirstChild()
      if (firstChild !== null) {
        firstChild.insertBefore(listItem)
      } else {
        nextNode.append(listItem)
      }
      parentNode.remove()
    } else if ($isListNode(previousNode) && previousNode.getListType() === listType) {
      previousNode.append(listItem)
      parentNode.remove()
    } else {
      const list = $createListNode(listType, listType === 'number' ? Number(match[2]) : undefined)
      list.append(listItem)
      parentNode.replace(list)
    }

    listItem.append(...children)
    if (!isImport) {
      listItem.select(0, 0)
    }

    const indent = getIndent(match[1])
    if (indent) {
      listItem.setIndent(indent)
    }
  }
}

// re-implemented
const $listExportParentheses = (listNode, exportChildren, depth) => {
  const output = []
  const children = listNode.getChildren()
  let index = 0

  for (const listItemNode of children) {
    if ($isListItemNode(listItemNode)) {
      if (listItemNode.getChildrenSize() === 1) {
        const firstChild = listItemNode.getFirstChild()
        if ($isListNode(firstChild)) {
          output.push($listExportParentheses(firstChild, exportChildren, depth + 1))
          continue
        }
      }
      const indent = ' '.repeat(depth * LIST_INDENT_SIZE)
      const listType = listNode.getListType()

      const prefix = listType === 'number' ? `${listNode.getStart() + index}) ` : `${index + 1}) `
      output.push(indent + prefix + exportChildren(listItemNode))
      index++
    }
  }
  return output.join('\n')
}

/** parentheses list transformer
 *
 *  rich mode: gets a list node and creates the appropriate markdown equivalent
 *
 *  markdown mode: from 1) or (1) text to list node
 *
 */
export const PARENTHESES_LIST = {
  dependencies: [ListNode, ListItemNode],
  export: (node, exportChildren) => {
    return $isListNode(node) && node.getListType() === 'number' ? $listExportParentheses(node, exportChildren, 0) : null
  },
  regExp: /^(\s*)(\d{1,})\)\s/,
  replace: listReplaceParentheses('number'),
  type: 'element'
}
