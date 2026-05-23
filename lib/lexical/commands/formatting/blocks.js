import { isMarkdownMode, $selectConsecutiveParagraphs } from '@/lib/lexical/commands/utils'
import { $snGetBlockType } from '@/lib/lexical/commands/formatting/utils'
import { $createCodeNode } from '@lexical/code'
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND
} from '@lexical/list'
import {
  createCommand, $getSelection, $isRangeSelection,
  COMMAND_PRIORITY_EDITOR, $createParagraphNode,
  $isElementNode, $isDecoratorNode, $isLineBreakNode
} from 'lexical'
import { $setBlocksType } from '@lexical/selection'
import { $createQuoteNode, $isQuoteNode } from '@lexical/rich-text'
import { $findMatchingParent } from '@lexical/utils'
import { $createSNHeadingNode } from '@/lib/lexical/nodes/misc/heading'
import { USE_TRANSFORMER_BRIDGE } from '@/components/editor/plugins/core/transformer-bridge'
import { MD_INSERT_BLOCK_COMMAND } from '@/lib/lexical/commands/formatting/markdown'
import { $splitParagraphsByLineBreaks } from '@/lib/lexical/nodes/utils'

/** command to format blocks (headings, lists, quotes, etc.)
 * @param {string} block - block type ('paragraph', 'h1', 'bullet', 'quote', etc.)
 * @returns {boolean} true if command was handled
 */
export const SN_FORMAT_BLOCK_COMMAND = createCommand('SN_FORMAT_BLOCK_COMMAND')

const $formatParagraph = (selection) => {
  $setBlocksType(selection, () => $createParagraphNode())
}

function $findQuoteParent (node) {
  return $isQuoteNode(node) ? node : $findMatchingParent(node, $isQuoteNode)
}

function $unwrapQuoteNode (quoteNode) {
  let paragraph = null

  const appendParagraphBeforeQuote = () => {
    if (paragraph?.getChildrenSize() > 0) {
      quoteNode.insertBefore(paragraph)
    }
    paragraph = null
  }

  for (const child of quoteNode.getChildren()) {
    if ($isLineBreakNode(child)) {
      appendParagraphBeforeQuote()
      continue
    }

    const isBlock = ($isElementNode(child) || $isDecoratorNode(child)) && !child.isInline()
    if (isBlock) {
      appendParagraphBeforeQuote()
      quoteNode.insertBefore(child)
      continue
    }

    paragraph ??= $createParagraphNode()
    paragraph.append(child)
  }

  appendParagraphBeforeQuote()
  quoteNode.remove()
}

function $unwrapSelectedQuotes (selection) {
  const quotes = new Map()

  for (const node of selection.getNodes()) {
    const quote = $findQuoteParent(node)
    if (quote) quotes.set(quote.getKey(), quote)
  }

  if ($isRangeSelection(selection)) {
    for (const point of [selection.anchor, selection.focus]) {
      const quote = $findQuoteParent(point.getNode())
      if (quote) quotes.set(quote.getKey(), quote)
    }
  }

  for (const quote of quotes.values()) {
    $unwrapQuoteNode(quote)
  }

  return quotes.size > 0
}

const $formatHeading = (activeBlock, block, selection) => {
  if (activeBlock === block) return
  $setBlocksType(selection, () => $createSNHeadingNode(block))
}

const $formatBulletList = (editor, activeBlock, block, selection) => {
  if (activeBlock === block) return $formatParagraph(selection)
  editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
}

const $formatNumberList = (editor, activeBlock, block, selection) => {
  if (activeBlock === block) return $formatParagraph(selection)
  editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
}

const $formatCheckList = (editor, activeBlock, block, selection) => {
  if (activeBlock === block) return $formatParagraph(selection)
  editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)
}

const $formatBlockQuote = (activeBlock, block, selection) => {
  if (activeBlock === block) {
    if (selection && $unwrapSelectedQuotes(selection)) return
    return $formatParagraph(selection)
  }
  if (!selection) return
  $setBlocksType(selection, () => $createQuoteNode())
}

const $formatCodeBlock = (activeBlock, block, selection) => {
  if (activeBlock === block) return $formatParagraph(selection)
  if (!selection) return
  if (!$isRangeSelection(selection) || selection.isCollapsed()) {
    $setBlocksType(selection, () => $createCodeNode())
  } else { // if we selected something
    // don't pull the whole paragraph into the code block
    $splitParagraphsByLineBreaks(selection)
    selection = $getSelection()
    if (!$isRangeSelection(selection)) {
      return
    }
    const textContent = selection.getTextContent()
    const codeNode = $createCodeNode()
    selection.insertNodes([codeNode])
    // After insertNodes, we need to get the updated selection
    const updatedSelection = $getSelection()
    if ($isRangeSelection(updatedSelection)) {
      updatedSelection.insertRawText(textContent)
    }
  }
}

/**
 * formats selection as a specific block type
 * @param {Object} editor - lexical editor instance
 * @param {string} block - block type ('paragraph', 'h1', 'bullet', 'quote', etc.)
 */
export function $formatBlock (editor, block) {
  const selection = $getSelection()
  const activeBlock = $snGetBlockType(selection)

  switch (block) {
    case 'paragraph':
      $formatParagraph(selection)
      break
    case 'h1':
    case 'h2':
    case 'h3':
      $formatHeading(activeBlock, block, selection)
      break
    case 'bullet':
      $formatBulletList(editor, activeBlock, block, selection)
      break
    case 'number':
      $formatNumberList(editor, activeBlock, block, selection)
      break
    case 'check':
      $formatCheckList(editor, activeBlock, block, selection)
      break
    case 'quote':
      $formatBlockQuote(activeBlock, block, selection)
      break
    case 'code':
      $formatCodeBlock(activeBlock, block, selection)
      break
  }
}

/**
 * registers command to format blocks (headings, lists, quotes, etc.)
 * @param {Object} params.editor - lexical editor instance
 * @returns {Function} unregister function
 */
export function registerSNFormatBlockCommand (editor) {
  return editor.registerCommand(SN_FORMAT_BLOCK_COMMAND, (block) => {
    const isMarkdown = isMarkdownMode(editor)

    // lexical rich mode formatting
    if (!isMarkdown) {
      $formatBlock(editor, block)
      return true
    }

    // markdown mode formatting via transformer bridge
    let selection = $getSelection()

    // if selection is collapsed, try to select all consecutive non-empty paragraphs at the caret position
    if (selection && selection.isCollapsed()) {
      // select all consecutive non-empty paragraphs
      $selectConsecutiveParagraphs()
      // get the new selection
      selection = $getSelection()
      // if we didn't find any paragraphs, fallback to markdown insertion
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        return editor.dispatchCommand(MD_INSERT_BLOCK_COMMAND, block)
      }
    }
    // use the transformer bridge to format the block
    return editor.dispatchCommand(USE_TRANSFORMER_BRIDGE, { formatType: 'block', transformation: block })
  }, COMMAND_PRIORITY_EDITOR)
}
