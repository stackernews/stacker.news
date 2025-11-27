import { $createParagraphNode, $createTextNode, $createLineBreakNode } from 'lexical'
import { $createQuoteNode } from '@lexical/rich-text'
import { $createSNHeadingNode } from '@/lib/lexical/nodes/misc/heading'
import { $createListNode, $createListItemNode } from '@lexical/list'
import { $createTableNode, $createTableRowNode, $createTableCellNode } from '@lexical/table'
import { $createHorizontalRuleNode } from '@lexical/extension'

// headings
export const HEADING = {
  type: 'heading',
  mdastType: 'heading',
  toMdast: (node, visitChildren) => ({
    type: 'heading',
    depth: () => {
      const tag = node.getTag()
      return parseInt(tag.substring(1)) || 1
    },
    children: node.getChildren().flatMap(visitChildren)
  }),
  fromMdast: (node, visitChildren) => {
    if (node.type !== 'heading') return null
    return $createSNHeadingNode(`h${node.depth}`).append(...visitChildren(node.children))
  },
  toMarkdown: (node, serialize) =>
    `${'#'.repeat(node.depth)} ${serialize(node.children)}\n\n`
}

// lists
export const LIST = {
  type: 'list',
  mdastType: 'list',
  toMdast: (node, visitChildren) => {
    const listType = node.getListType()
    const children = node.getChildren().flatMap(visitChildren)
    return {
      type: 'list',
      ordered: listType === 'number',
      spread: false,
      children
    }
  },
  fromMdast: (node, visitChildren) => {
    if (node.type !== 'list') return null
    // detect checklist: if any item has checked !== null, it's a checklist
    const isChecklist = node.children?.some(item => item.checked !== null)
    let listType = 'bullet'
    if (node.ordered) {
      listType = 'number'
    } else if (isChecklist) {
      listType = 'check'
    }
    return $createListNode(listType).append(...visitChildren(node.children))
  },
  toMarkdown: (node, serialize) => {
    const items = node.children.map((item, i) => {
      let marker
      if (node.ordered) {
        marker = `${i + 1}.`
      } else if (item.checked !== null) {
        marker = item.checked ? '- [x]' : '- [ ]'
      } else {
        marker = '-'
      }
      const content = serialize(item.children).replace(/\n\n$/, '')
      return `${marker} ${content}`
    })
    return items.join('\n') + '\n\n'
  }
}

export const LIST_ITEM = {
  type: 'listitem',
  mdastType: 'listItem',
  toMdast: (node, visitChildren) => ({
    type: 'listItem',
    checked: node.getChecked?.() ?? null,
    children: node.getChildren().flatMap(visitChildren)
  }),
  fromMdast: (node, visitChildren) => {
    if (node.type !== 'listItem') return null
    const item = $createListItemNode(node.checked)
    // insert line breaks between paragraph children to prevent inline rendering
    // Lexical does not support paragraphs inside list items, it expects inline content
    // this will emulate the behavior of a paragraph by inserting line breaks between the children
    const lexicalChildren = visitChildren(node.children)
    lexicalChildren.forEach((child, index) => {
      item.append(child)

      // line break between children, but not after the last one
      if (index < lexicalChildren.length - 1) {
        item.append($createLineBreakNode())
      }
    })
    return item
  }
}

// blockquotes
export const BLOCKQUOTE = {
  type: 'quote',
  mdastType: 'blockquote',
  toMdast: (node, visitChildren) => ({
    type: 'blockquote',
    children: node.getChildren().flatMap(visitChildren)
  }),
  fromMdast: (node, visitChildren) => {
    if (node.type !== 'blockquote') return null
    return $createQuoteNode().append(...visitChildren(node.children))
  },
  toMarkdown: (node, serialize) => {
    const content = serialize(node.children).trim()
    return content.split('\n').map(line => `> ${line}`).join('\n') + '\n\n'
  }
}

// tables
export const TABLE = {
  type: 'table',
  mdastType: 'table',
  toMdast: (node, visitChildren) => ({
    type: 'table',
    children: node.getChildren().flatMap(visitChildren)
  }),
  fromMdast: (node, visitChildren) => {
    if (node.type !== 'table') return null
    return $createTableNode().append(...visitChildren(node.children))
  },
  toMarkdown: (node, serialize) => {
    const rows = node.children.map(row =>
      `| ${row.children.map(cell => serialize(cell.children)).join(' | ')} |`
    )
    if (rows.length > 0) {
      const colCount = node.children[0]?.children?.length || 1
      rows.splice(1, 0, `|${' --- |'.repeat(colCount)}`)
    }
    return rows.join('\n') + '\n\n'
  }
}

export const TABLE_ROW = {
  type: 'tablerow',
  mdastType: 'tableRow',
  toMdast: (node, visitChildren) => ({
    type: 'tableRow',
    children: node.getChildren().flatMap(visitChildren)
  }),
  fromMdast: (node, visitChildren) => {
    if (node.type !== 'tableRow') return null
    return $createTableRowNode().append(...visitChildren(node.children))
  }
}

export const TABLE_CELL = {
  type: 'tablecell',
  mdastType: 'tableCell',
  toMdast: (node, visitChildren) => ({
    type: 'tableCell',
    children: node.getChildren().flatMap(visitChildren)
  }),
  fromMdast: (node, visitChildren) => {
    if (node.type !== 'tableCell') return null
    return $createTableCellNode().append(...visitChildren(node.children))
  }
}

// horizontal rule
export const HORIZONTAL_RULE = {
  type: 'horizontalrule',
  mdastType: 'thematicBreak',
  toMdast: () => ({ type: 'thematicBreak' }),
  fromMdast: (node) => node.type === 'thematicBreak' && $createHorizontalRuleNode(),
  toMarkdown: () => '---\n\n'
}

// hard line break (two trailing spaces + newline in markdown)
export const HARD_BREAK = {
  type: 'linebreak',
  mdastType: 'break',
  toMdast: () => ({ type: 'break' }),
  // a <br> between two spans (what lexical generates for text nodes) is not enough, we need two <br>s
  fromMdast: (node) => node.type === 'break' && [$createLineBreakNode(), $createLineBreakNode()],
  toMarkdown: () => '  \n'
}

// html fallback
export const HTML_FALLBACK = {
  mdastType: 'html',
  fromMdast: (node) => {
    if (node.type !== 'html') return null
    return $createParagraphNode().append($createTextNode(node.value))
  },
  toMarkdown: (node) => node.value + '\n\n'
}

// paragraph
export const PARAGRAPH = {
  type: 'paragraph',
  mdastType: 'paragraph',
  toMdast: (node, visitChildren) => ({
    type: 'paragraph',
    children: node.getChildren().flatMap(visitChildren)
  }),
  fromMdast: (node, visitChildren) => {
    if (node.type !== 'paragraph') return null
    return $createParagraphNode().append(...visitChildren(node.children))
  },
  toMarkdown: (node, serialize) => `${serialize(node.children)}\n\n`
}

export default [
  HEADING,
  LIST,
  LIST_ITEM,
  BLOCKQUOTE,
  TABLE,
  TABLE_ROW,
  TABLE_CELL,
  HORIZONTAL_RULE,
  HARD_BREAK,
  HTML_FALLBACK,
  PARAGRAPH
]
