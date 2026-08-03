/* eslint-env jest */

import { createHeadlessEditor } from '@lexical/headless'
import { CodeNode, CodeHighlightNode, $createCodeNode, $createCodeHighlightNode } from '@lexical/code-core'
import { QuoteNode, $createQuoteNode, $isQuoteNode } from '@lexical/rich-text'
import {
  $createParagraphNode, $createTextNode, $createRangeSelection,
  $getRoot, $isParagraphNode, $setSelection
} from 'lexical'

// mock modules that drag ESM-only deps (github-slugger, micromark, mdast) into
// the test environment; they're only used by formatting paths this suite doesn't exercise
jest.mock('../../../lexical/nodes/misc/heading.jsx', () => ({
  $createSNHeadingNode: () => { throw new Error('heading formatting not exercised in this suite') }
}))
jest.mock('../../../../components/editor/plugins/core/transformer-bridge.js', () => ({
  USE_TRANSFORMER_BRIDGE: {}
}))
jest.mock('./markdown.js', () => ({
  MD_INSERT_BLOCK_COMMAND: {},
  MD_FORMAT_COMMAND: {}
}))

// eslint-disable-next-line import/first
import { $formatBlock } from './blocks'

/** creates a headless editor with the nodes needed for the block format tests */
const createQuoteEditor = () => createHeadlessEditor({
  nodes: [CodeNode, CodeHighlightNode, QuoteNode]
})

/** sets a range selection between the given text nodes and offsets */
const $selectRange = (anchorNode, anchorOffset, focusNode = anchorNode, focusOffset = anchorOffset) => {
  const selection = $createRangeSelection()
  selection.anchor.set(anchorNode.getKey(), anchorOffset, 'text')
  selection.focus.set(focusNode.getKey(), focusOffset, 'text')
  $setSelection(selection)
}

describe('quote block formatting', () => {
  test('toggles a paragraph into a quote', () => {
    const editor = createQuoteEditor()
    editor.update(() => {
      const paragraph = $createParagraphNode()
      const text = $createTextNode('hello')
      paragraph.append(text)
      $getRoot().append(paragraph)
      $selectRange(text, 1, text, 4)
      $formatBlock(editor, 'quote')
    })

    editor.read(() => {
      expect($getRoot().getChildrenSize()).toBe(1)
      const child = $getRoot().getFirstChild()
      expect($isQuoteNode(child)).toBe(true)
      expect(child.getTextContent()).toBe('hello')
    })
  })

  test('removing a quote preserves a nested code block instead of destroying it', () => {
    const editor = createQuoteEditor()
    editor.update(() => {
      const quote = $createQuoteNode()
      const code = $createCodeNode()
      const codeText = $createCodeHighlightNode('const x = 1')
      code.append(codeText)
      quote.append(code)
      $getRoot().append(quote)
      $selectRange(codeText, 3, codeText, 3)
      $formatBlock(editor, 'quote')
    })

    editor.read(() => {
      expect($getRoot().getChildrenSize()).toBe(1)
      const child = $getRoot().getFirstChild()
      expect(child.getType()).toBe('code')
      expect(child.getTextContent()).toBe('const x = 1')
    })
  })

  test('removing a quote on plain text turns it into a paragraph', () => {
    const editor = createQuoteEditor()
    editor.update(() => {
      const quote = $createQuoteNode()
      const text = $createTextNode('hello')
      quote.append(text)
      $getRoot().append(quote)
      $selectRange(text, 1, text, 4)
      $formatBlock(editor, 'quote')
    })

    editor.read(() => {
      expect($getRoot().getChildrenSize()).toBe(1)
      const child = $getRoot().getFirstChild()
      expect($isParagraphNode(child)).toBe(true)
      expect(child.getTextContent()).toBe('hello')
    })
  })

  test('adding a quote around a code block keeps the code block', () => {
    const editor = createQuoteEditor()
    editor.update(() => {
      const code = $createCodeNode()
      const codeText = $createCodeHighlightNode('const x = 1')
      code.append(codeText)
      $getRoot().append(code)
      $selectRange(codeText, 2, codeText, 2)
      $formatBlock(editor, 'quote')
    })

    editor.read(() => {
      expect($getRoot().getChildrenSize()).toBe(1)
      const quote = $getRoot().getFirstChild()
      expect($isQuoteNode(quote)).toBe(true)
      expect(quote.getFirstChild().getType()).toBe('code')
      expect(quote.getTextContent()).toBe('const x = 1')
    })
  })

  test('removing a quote around another quote keeps the inner quote', () => {
    const editor = createQuoteEditor()
    editor.update(() => {
      const outerQuote = $createQuoteNode()
      const innerQuote = $createQuoteNode()
      const text = $createTextNode('nested')
      innerQuote.append(text)
      outerQuote.append(innerQuote)
      $getRoot().append(outerQuote)
      $selectRange(text, 2, text, 2)
      $formatBlock(editor, 'quote')
    })

    editor.read(() => {
      expect($getRoot().getChildrenSize()).toBe(1)
      const child = $getRoot().getFirstChild()
      expect($isQuoteNode(child)).toBe(true)
      expect(child.getTextContent()).toBe('nested')
    })
  })
})
