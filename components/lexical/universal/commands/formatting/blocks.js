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

const formatParagraph = () => {
  const selection = $getSelection()
  $setBlocksType(selection, () => $createParagraphNode())
}

const formatHeading = (activeBlock, block) => {
  const selection = $getSelection()
  if (activeBlock === block) return
  $setBlocksType(selection, () => $createHeadingNode(block))
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

const formatBlockQuote = (activeBlock, block) => {
  if (activeBlock === block) return
  const selection = $getSelection()
  if (!selection) return
  $setBlocksType(selection, () => $createQuoteNode())
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
