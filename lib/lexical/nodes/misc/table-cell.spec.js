/* eslint-env jest */

import { createHeadlessEditor } from '@lexical/headless'
import { $createTableCellNode, $createTableNode, $createTableRowNode, TableCellHeaderStates, TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { $generateHtmlFromNodes } from '@lexical/html'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import { SNTableCellNode, $createSNTableCellNode } from './table-cell'
import { withDOM } from '@/lib/lexical/server/dom'

function createEditor () {
  return createHeadlessEditor({
    namespace: 'sn-table-cell-test',
    nodes: [
      TableNode,
      SNTableCellNode,
      {
        replace: TableCellNode,
        with: (node) => $createSNTableCellNode(node.getHeaderStyles(), node.getColSpan(), node.getWidth())
          .setRowSpan(node.getRowSpan())
          .setBackgroundColor(node.getBackgroundColor())
          .setVerticalAlign(node.getVerticalAlign()),
        withKlass: SNTableCellNode
      },
      TableRowNode
    ],
    theme: {
      paragraph: 'sn-paragraph',
      table: 'sn-table',
      tableCell: 'sn-table__cell',
      tableCellHeader: 'sn-table__cell--header'
    },
    onError: (error) => {
      throw error
    }
  })
}

function createTableHtml ({ configureCell } = {}) {
  return withDOM(() => {
    const editor = createEditor()
    let html

    editor.update(() => {
      const table = $createTableNode()
      const row = $createTableRowNode()
      const cell = $createTableCellNode(TableCellHeaderStates.ROW)

      configureCell?.(cell)
      cell.append($createParagraphNode().append($createTextNode('header')))
      row.append(cell)
      table.append(row)

      const root = $getRoot()
      root.clear()
      root.append(table)
    }, { discrete: true })

    editor.getEditorState().read(() => {
      html = $generateHtmlFromNodes(editor)
    })

    return html
  })
}

describe('SNTableCellNode', () => {
  test('does not export Lexical default inline cell styles', () => {
    const html = createTableHtml()

    expect(html).toContain('sn-table__cell')
    expect(html).toContain('sn-table__cell--header')
    expect(html).not.toContain('1px solid black')
    expect(html).not.toMatch(/width:\s*75px/)
    expect(html).not.toMatch(/vertical-align:\s*top/)
    expect(html).not.toMatch(/text-align:\s*start/)
    expect(html).not.toMatch(/background-color:\s*rgb\(242,\s*243,\s*245\)/)
    expect(html).not.toContain('#f2f3f5')
  })

  test('keeps intentional cell export styles', () => {
    const html = createTableHtml({
      configureCell: (cell) => {
        cell
          .setWidth(120)
          .setVerticalAlign('middle')
          .setBackgroundColor('rgb(1, 2, 3)')
      }
    })

    expect(html).toMatch(/width:\s*120px/)
    expect(html).toMatch(/vertical-align:\s*middle/)
    expect(html).toMatch(/background-color:\s*rgb\(1,\s*2,\s*3\)/)
  })
})
