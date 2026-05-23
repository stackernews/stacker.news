/* eslint-env jest */
jest.mock('../../nodes/misc/heading', () => {
  const { $createParagraphNode } = jest.requireActual('lexical')
  return {
    $createSNHeadingNode: () => $createParagraphNode()
  }
}, { virtual: true })

jest.mock('../../../../components/editor/plugins/core/transformer-bridge.js', () => {
  const { createCommand } = jest.requireActual('lexical')
  return {
    __esModule: true,
    default: () => null,
    USE_TRANSFORMER_BRIDGE: createCommand('USE_TRANSFORMER_BRIDGE')
  }
})

jest.mock('./markdown', () => {
  const { createCommand } = jest.requireActual('lexical')
  return {
    MD_INSERT_BLOCK_COMMAND: createCommand('MD_INSERT_BLOCK_COMMAND')
  }
})

const { createHeadlessEditor } = require('@lexical/headless')
const { $createCodeNode, CodeNode } = require('@lexical/code')
const { $createQuoteNode, QuoteNode } = require('@lexical/rich-text')
const { $createTextNode, $getRoot, $isElementNode } = require('lexical')
const { $formatBlock } = require('./blocks')

function createEditor () {
  return createHeadlessEditor({
    namespace: 'sn-format-block-test',
    nodes: [CodeNode, QuoteNode],
    onError: error => {
      throw error
    }
  })
}

function readRootJSON (editor) {
  let root
  editor.getEditorState().read(() => {
    const serialize = node => {
      const json = node.exportJSON()
      if ($isElementNode(node)) {
        json.children = node.getChildren().map(serialize)
      }
      return json
    }
    root = serialize($getRoot())
  })
  return root
}

describe('$formatBlock', () => {
  test('turning off quote preserves nested code blocks imported from markdown', () => {
    const editor = createEditor()

    editor.update(() => {
      const code = $createCodeNode('js').append($createTextNode('console.log(hello)'))
      const quote = $createQuoteNode().append(code)
      $getRoot().append(quote)
    }, { discrete: true })

    editor.update(() => {
      const quote = $getRoot().getFirstChild()
      const code = quote.getFirstChild()
      const text = code.getFirstChild()

      text.select(0, text.getTextContentSize())
      $formatBlock(editor, 'quote')
    }, { discrete: true })

    const root = readRootJSON(editor)
    expect(root.children).toHaveLength(1)
    expect(root.children[0].type).toBe('code')
    expect(root.children[0].children[0].text).toBe('console.log(hello)')
  })
})
