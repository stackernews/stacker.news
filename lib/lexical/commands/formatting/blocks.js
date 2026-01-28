import { $isMarkdownMode } from '@/lib/lexical/commands/utils'
import { $snGetBlockType } from '@/lib/lexical/commands/formatting/utils'
import { $createCodeNode } from '@lexical/code'
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND
} from '@lexical/list'
import {
  createCommand, $getSelection, $isRangeSelection,
  COMMAND_PRIORITY_EDITOR, $createParagraphNode
} from 'lexical'
import { $setBlocksType } from '@lexical/selection'
import { $createQuoteNode } from '@lexical/rich-text'
import { $createSNHeadingNode } from '@/lib/lexical/nodes/misc/heading'
import { USE_TRANSFORMER_BRIDGE } from '@/components/editor/plugins/core/transformer-bridge'
import { $createMediaNode } from '../../nodes/content/media'
import { handleMDInsertBlockCommand } from '@/lib/lexical/exts/md-commands'

/** command to format blocks (headings, lists, quotes, etc.)
 * @param {string} block - block type ('paragraph', 'h1', 'bullet', 'quote', etc.)
 * @returns {boolean} true if command was handled
 */
export const SN_FORMAT_BLOCK_COMMAND = createCommand('SN_FORMAT_BLOCK_COMMAND')

const $formatParagraph = (selection) => {
  $setBlocksType(selection, () => $createParagraphNode())
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
  if (activeBlock === block) return $formatParagraph(selection)
  if (!selection) return
  $setBlocksType(selection, () => $createQuoteNode())
}

const $formatCodeBlock = (activeBlock, block, selection) => {
  if (activeBlock === block) return $formatParagraph(selection)
  if (!selection) return
  if (!$isRangeSelection(selection) || selection.isCollapsed()) {
    $setBlocksType(selection, () => $createCodeNode())
  } else { // if we selected something
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

// TODO: this won't work, we should prefer normal markdown syntax manipulation via md-commands
const $formatExternalImage = (activeBlock, block, selection) => {
  if (activeBlock === block) return $formatParagraph(selection)
  if (!selection) return
  if (!$isRangeSelection(selection) || selection.isCollapsed()) {
    $setBlocksType(selection, () => $createMediaNode())
  } else {
    const textContent = selection.getTextContent()
    const mediaNode = $createMediaNode({ src: textContent })
    selection.insertNodes([mediaNode])
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
    case 'externalImage':
      $formatExternalImage(activeBlock, block, selection)
      break
  }
}

/**
 * registers command to format blocks (headings, lists, quotes, etc.)
 * @param {Object} params.editor - lexical editor instance
 * @returns {Function} unregister function
 */
export function registerSNFormatBlockCommand ({ editor }) {
  return editor.registerCommand(SN_FORMAT_BLOCK_COMMAND, (block) => {
    const markdownMode = $isMarkdownMode()
    const selection = $getSelection()

    // lexical rich mode formatting
    if (!markdownMode) {
      $formatBlock(editor, block)
      return true
    }

    // markdown mode formatting via transformer bridge
    if (!$isRangeSelection(selection) || selection.isCollapsed()) return handleMDInsertBlockCommand(block)
    // use the transformer bridge to format the block
    return editor.dispatchCommand(USE_TRANSFORMER_BRIDGE, { formatType: 'block', transformation: block })
  }, COMMAND_PRIORITY_EDITOR)
}
