/* eslint-env jest */
jest.mock('../../nodes/misc/heading', () => ({
  $createSNHeadingNode: jest.fn(() => {
    throw new Error('unexpected heading formatting in block quote tests')
  })
}))

jest.mock('../../../../components/editor/plugins/core/transformer-bridge', () => ({
  USE_TRANSFORMER_BRIDGE: 'USE_TRANSFORMER_BRIDGE'
}))

jest.mock('./markdown', () => ({
  MD_INSERT_BLOCK_COMMAND: 'MD_INSERT_BLOCK_COMMAND'
}))

const { createHeadlessEditor } = require('@lexical/headless')
const { $createTextNode, $getRoot, $selectAll } = require('lexical')
const { CodeHighlightNode, CodeNode, $createCodeNode, $isCodeNode } = require('@lexical/code-core')
const { QuoteNode, $createQuoteNode } = require('@lexical/rich-text')
const { $formatBlock } = require('./blocks')

function updateEditor (editor, fn) {
  editor.update(fn, { discrete: true })
}

function createEditor () {
  return createHeadlessEditor({
    namespace: 'sn-test',
    nodes: [QuoteNode, CodeNode, CodeHighlightNode],
    onError: error => { throw error }
  })
}

describe('$formatBlock', () => {
  test('unwraps a quote around a fenced code block without dropping the code block', () => {
    const editor = createEditor()

    let firstChildType
    let firstChildText
    let firstChildIsCode

    updateEditor(editor, () => {
      const root = $getRoot()
      const code = $createCodeNode('js').append($createTextNode('console.log(hello)'))
      root.append($createQuoteNode().append(code))
      code.selectEnd()

      $formatBlock(editor, 'quote')

      const firstChild = root.getFirstChild()
      firstChildType = firstChild.getType()
      firstChildText = firstChild.getTextContent()
      firstChildIsCode = $isCodeNode(firstChild)
    })

    expect(firstChildIsCode).toBe(true)
    expect(firstChildType).toBe('code')
    expect(firstChildText).toBe('console.log(hello)')
  })

  test('unwraps a selected quote node when the selection starts at the root', () => {
    const editor = createEditor()

    let firstChildType
    let firstChildText
    let firstChildIsCode

    updateEditor(editor, () => {
      const root = $getRoot()
      const code = $createCodeNode('js').append($createTextNode('console.log(hello)'))
      root.append($createQuoteNode().append(code))
      $selectAll()

      $formatBlock(editor, 'quote')

      const firstChild = root.getFirstChild()
      firstChildType = firstChild.getType()
      firstChildText = firstChild.getTextContent()
      firstChildIsCode = $isCodeNode(firstChild)
    })

    expect(firstChildIsCode).toBe(true)
    expect(firstChildType).toBe('code')
    expect(firstChildText).toBe('console.log(hello)')
  })

  test('unwraps inline quote content into a paragraph', () => {
    const editor = createEditor()

    let firstChildType
    let firstChildText

    updateEditor(editor, () => {
      const root = $getRoot()
      const text = $createTextNode('quoted')
      root.append($createQuoteNode().append(text))
      text.select()

      $formatBlock(editor, 'quote')

      const firstChild = root.getFirstChild()
      firstChildType = firstChild.getType()
      firstChildText = firstChild.getTextContent()
    })

    expect(firstChildType).toBe('paragraph')
    expect(firstChildText).toBe('quoted')
  })
})
