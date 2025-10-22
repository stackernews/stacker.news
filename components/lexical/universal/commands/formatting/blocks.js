import { $isMarkdownMode } from '@/components/lexical/universal/utils'
import { snGetBlockType } from '@/components/lexical/universal/utils/formatting'
import { $createCodeNode } from '@lexical/code'
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND
} from '@lexical/list'
import { createCommand, $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, $createParagraphNode } from 'lexical'
import { $setBlocksType } from '@lexical/selection'
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import { USE_TRANSFORMER_BRIDGE } from '@/components/lexical/plugins/core/transformerbridge'

export const SN_FORMAT_BLOCK_COMMAND = createCommand('SN_FORMAT_BLOCK_COMMAND')

export const START_MARKDOWN_FORMATS = {
  h1: '#',
  h2: '##',
  h3: '###',
  bullet: '*',
  check: '- [ ]'
}

const formatParagraph = () => {
  const selection = $getSelection()
  $setBlocksType(selection, () => $createParagraphNode())
}

const formatHeading = (activeBlock, block, isMarkdownMode) => {
  const selection = $getSelection()
  if (!isMarkdownMode) {
    if (activeBlock === block) return
    $setBlocksType(selection, () => $createHeadingNode(block))
  } else {
    const text = selection.getTextContent()
    const lines = text.split('\n')
    const allHeadings = lines.every(l => l.startsWith(START_MARKDOWN_FORMATS[block]))
    const newLines = allHeadings
      ? lines.map(l => l.replace(`${START_MARKDOWN_FORMATS[block]} `, ''))
      : lines.map(l => (l.length ? `${START_MARKDOWN_FORMATS[block]} ${l}` : l))
    selection.insertText(newLines.join('\n'))
  }
}

const formatBulletList = (editor, activeBlock, block) => {
  if (activeBlock === block) return formatParagraph()
  editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
}

const formatNumberList = (editor, activeBlock, block) => {
  if (activeBlock === block) return formatParagraph()
  editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
}

const formatCheckList = (editor, activeBlock, block) => {
  if (activeBlock === block) return formatParagraph()
  editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)
}

/* function toggleBlockQuote (selection) {

} */

const formatBlockQuote = (activeBlock, block, isMarkdownMode) => {
  if (activeBlock === block) return
  const selection = $getSelection()
  if (!selection) return
  if (!isMarkdownMode) {
    $setBlocksType(selection, () => $createQuoteNode())
  } else if ($isRangeSelection(selection)) {
    const text = selection.getTextContent()
    const lines = text.split('\n')
    const allQuoted = lines.every(l => l.startsWith('> '))
    const newLines = allQuoted
      ? lines.map(l => l.replace(/^> /, ''))
      : lines.map(l => (l.length ? `> ${l}` : l))
    selection.insertText(newLines.join('\n'))
  }
}

const formatCodeBlock = (activeBlock, block) => {
  if (activeBlock === block) return
  let selection = $getSelection()
  if (!selection) return
  if (!$isRangeSelection(selection) || selection.isCollapsed()) {
    $setBlocksType(selection, () => $createCodeNode())
  } else {
    const textContent = selection.getTextContent()
    const codeNode = $createCodeNode()
    selection.insertNodes([codeNode])
    selection = $getSelection()
    if ($isRangeSelection(selection)) {
      selection.insertRawText(textContent)
    }
  }
}

export function $formatBlock (editor, block) {
  const activeBlock = snGetBlockType({ selection: $getSelection(), editor })
  switch (block) {
    case 'paragraph':
      formatParagraph()
      break
    case 'h1':
    case 'h2':
    case 'h3':
      formatHeading(activeBlock, block)
      break
    case 'bullet':
      formatBulletList(editor, activeBlock, block)
      break
    case 'number':
      formatNumberList(editor, activeBlock, block)
      break
    case 'check':
      formatCheckList(editor, activeBlock, block)
      break
    case 'quote':
      formatBlockQuote(activeBlock, block)
      break
    case 'code':
      formatCodeBlock(activeBlock, block)
      break
  }
}

export function registerSNFormatBlockCommand ({ editor }) {
  return editor.registerCommand(SN_FORMAT_BLOCK_COMMAND, (block) => {
    // markdown mode formatting
    if ($isMarkdownMode()) {
      // use the transformer bridge to format the block
      return editor.dispatchCommand(USE_TRANSFORMER_BRIDGE, { formatType: 'block', transformation: block })
    }

    // lexical rich mode formatting
    $formatBlock(editor, block)
    return true
  }, COMMAND_PRIORITY_EDITOR)
}
