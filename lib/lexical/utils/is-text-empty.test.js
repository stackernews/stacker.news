/* eslint-env jest */

import { createHeadlessEditor } from '@lexical/headless'
import { TableCellNode, TableNode, TableRowNode, $createTableNodeWithDimensions } from '@lexical/table'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'

// mdast pulls ESM-only packages (micromark, mdast-util-gfm) that the jest
// environment cannot load; this suite only exercises $isTextEmpty/$getTextContent
jest.mock('./mdast', () => ({
  $markdownToLexical: () => {},
  $lexicalToMarkdown: () => '',
  removeZeroWidthSpace: (str) => str
}))

// eslint-disable-next-line import/first
import { $isTextEmpty } from './index'

const createEditor = () => createHeadlessEditor({
  nodes: [TableNode, TableRowNode, TableCellNode]
})

describe('$isTextEmpty', () => {
  test('an empty table is not considered empty', () => {
    const editor = createEditor()
    editor.update(() => {
      $getRoot().append($createTableNodeWithDimensions(1, 1))
    })
    editor.read(() => {
      expect($getRoot().getChildrenSize()).toBe(1)
      expect($isTextEmpty()).toBe(false)
    })
  })

  test('a table with text is not considered empty', () => {
    const editor = createEditor()
    editor.update(() => {
      const table = $createTableNodeWithDimensions(1, 1)
      const cell = table.getFirstChild().getFirstChild()
      cell.append($createTextNode('hello'))
      $getRoot().append(table)
    })
    editor.read(() => {
      expect($isTextEmpty()).toBe(false)
    })
  })

  test('only empty paragraphs are considered empty', () => {
    const editor = createEditor()
    editor.update(() => {
      $getRoot().append($createParagraphNode())
      $getRoot().append($createParagraphNode())
    })
    editor.read(() => {
      expect($isTextEmpty()).toBe(true)
    })
  })

  test('an empty root is considered empty', () => {
    const editor = createEditor()
    editor.read(() => {
      expect($isTextEmpty()).toBe(true)
    })
  })

  test('a paragraph with text is not considered empty', () => {
    const editor = createEditor()
    editor.update(() => {
      const paragraph = $createParagraphNode()
      paragraph.append($createTextNode('hello'))
      $getRoot().append(paragraph)
    })
    editor.read(() => {
      expect($isTextEmpty()).toBe(false)
    })
  })
})
