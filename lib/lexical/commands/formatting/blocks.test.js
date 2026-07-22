/* eslint-env jest */

import { createHeadlessEditor } from '@lexical/headless'
import { CodeNode, $createCodeNode, $isCodeNode } from '@lexical/code-core'
import { QuoteNode, $createQuoteNode, $isQuoteNode } from '@lexical/rich-text'
import { $createParagraphNode, $createTextNode, $getRoot, $isParagraphNode } from 'lexical'
import { $unwrapSelectedQuotes } from './quote'

function createEditor () {
  return createHeadlessEditor({
    namespace: 'sn-rich',
    nodes: [CodeNode, QuoteNode],
    onError: error => { throw error }
  })
}

describe('$formatBlock quote', () => {
  test('unwraps a quoted code block without converting the code block', () => {
    const editor = createEditor()

    editor.update(() => {
      const text = $createTextNode('console.log("hello")')
      const code = $createCodeNode().append(text)
      $getRoot().append($createQuoteNode().append(code))
      text.select(0, 0)

      $unwrapSelectedQuotes(text.getLatest().select(0, 0))
    }, { discrete: true })

    editor.getEditorState().read(() => {
      const children = $getRoot().getChildren()
      expect(children).toHaveLength(1)
      expect($isCodeNode(children[0])).toBe(true)
      expect(children[0].getTextContent()).toBe('console.log("hello")')
    })
  })

  test('preserves the order and types of all blocks when unwrapping a quote', () => {
    const editor = createEditor()

    editor.update(() => {
      const codeText = $createTextNode('const answer = 42')
      const code = $createCodeNode().append(codeText)
      const paragraph = $createParagraphNode().append($createTextNode('explanation'))
      $getRoot().append($createQuoteNode().append(code, paragraph))
      codeText.select(0, 0)

      $unwrapSelectedQuotes(codeText.getLatest().select(0, 0))
    }, { discrete: true })

    editor.getEditorState().read(() => {
      const children = $getRoot().getChildren()
      expect(children).toHaveLength(2)
      expect($isCodeNode(children[0])).toBe(true)
      expect($isParagraphNode(children[1])).toBe(true)
      expect(children.map(node => node.getTextContent())).toEqual(['const answer = 42', 'explanation'])
      expect(children.some($isQuoteNode)).toBe(false)
    })
  })
})
