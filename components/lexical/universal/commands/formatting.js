import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand, FORMAT_TEXT_COMMAND, $createParagraphNode } from 'lexical'
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $isMarkdownMode } from '../utils'
import { $createCodeNode } from '@lexical/code'
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND
} from '@lexical/list'

export const SN_FORMAT_TEXT_COMMAND = createCommand('SN_FORMAT_TEXT_COMMAND')
export const SN_FORMAT_BLOCK_COMMAND = createCommand('SN_FORMAT_BLOCK_COMMAND')

export const START_END_MARKDOWN_FORMATS = {
  bold: '**',
  italic: ['*', '_'],
  code: '`',
  strikethrough: ['~~', '~'],
  underline: ['++', '__'],
  highlight: ['=='],
  codeblock: '```'
}

export const START_MARKDOWN_FORMATS = {
  heading1: '#',
  heading2: '##',
  heading3: '###',
  bullet: '*',
  check: '- [ ]'
}

function isCase (text, type) {
  return type === 'lowercase' ? text.toLowerCase() === text : text.toUpperCase() === text
}

function isCapitalize (text) {
  return text.charAt(0).toUpperCase() === text.charAt(0) && text.slice(1).toLowerCase() === text.slice(1)
}

function toggleCase (selection, type) {
  const text = selection.getTextContent()
  const newText = type === 'lowercase' ? text.toLowerCase() : text.toUpperCase()
  selection.insertText(newText)
}

function toggleCapitalize (selection) {
  const text = selection.getTextContent()
  const newText = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
  selection.insertText(newText)
}

export function hasMarkdownFormat (selection, type) {
  if (!selection) return
  const text = selection.getTextContent()
  if (!text) return false
  switch (type) {
    case 'lowercase':
      return isCase(text, type)
    case 'uppercase':
      return isCase(text, type)
    case 'capitalize':
      return isCapitalize(text)
    case 'quote':
      return text.startsWith('>')
    case 'subscript':
      return text.startsWith('<sub>') && text.endsWith('</sub>')
    case 'superscript':
      return text.startsWith('<sup>') && text.endsWith('</sup>')
    default:
      break
  }
  const match = START_END_MARKDOWN_FORMATS[type]
  if (!match) return false
  if (Array.isArray(match)) {
    return match.some(marker => text.startsWith(marker) && text.endsWith(marker) && text.length >= marker.length * 2)
  }
  return text.startsWith(match) && text.endsWith(match) && text.length >= match.length * 2
}

function toggleInlineMarkdown (selection, marker) {
  if (!selection) return
  if (selection.isCollapsed()) {
    selection.insertText(marker + marker)
    const { anchor } = selection
    const node = anchor.getNode()
    const offset = anchor.offset
    selection.setTextNodeRange(node, offset - marker.length, node, offset - marker.length)
  } else {
    const text = selection.getTextContent()
    const hasWrap = text.startsWith(marker) && text.endsWith(marker)
    const newText = hasWrap ? text.slice(marker.length, text.length - marker.length) : marker + text + marker
    selection.insertText(newText)
  }
}

function toggleBlockQuote (selection) {
  if (!selection) return
  const text = selection.getTextContent()
  const lines = text.split('\n')
  const allQuoted = lines.every(l => l.startsWith('> '))
  const newLines = allQuoted
    ? lines.map(l => l.replace(/^> /, ''))
    : lines.map(l => (l.length ? `> ${l}` : l))
  selection.insertText(newLines.join('\n'))
}

function wrapWithTag (selection, tag) {
  if (!selection) return
  const before = `<${tag}>`
  const after = `</${tag}>`
  if (selection.isCollapsed()) {
    selection.insertText(before + after)
    const { anchor } = selection
    const node = anchor.getNode()
    const offset = anchor.offset
    selection.setTextNodeRange(node, offset - after.length, node, offset - after.length)
  } else {
    const text = selection.getTextContent()
    const hasWrap = text.startsWith(before) && text.endsWith(after)
    const newText = hasWrap ? text.slice(before.length, text.length - after.length) : before + text + after
    selection.insertText(newText)
  }
}

export function registerSNFormatTextCommand ({ editor }) {
  return editor.registerCommand(SN_FORMAT_TEXT_COMMAND, (type) => {
    const markdownMode = $isMarkdownMode()
    if (!markdownMode) {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, type)
      return true
    }

    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    // handle special cases
    switch (type) {
      case 'lowercase':
      case 'uppercase':
        return toggleCase(selection, type)
      case 'capitalize':
        return toggleCapitalize(selection)
      case 'quote':
        return toggleBlockQuote(selection)
      case 'subscript':
        return wrapWithTag(selection, 'sub')
      case 'superscript':
        return wrapWithTag(selection, 'sup')
      default:
        break
    }
    // handle inline markdown
    if (START_END_MARKDOWN_FORMATS[type]) {
      return toggleInlineMarkdown(
        selection,
        Array.isArray(START_END_MARKDOWN_FORMATS[type])
          ? START_END_MARKDOWN_FORMATS[type][0]
          : START_END_MARKDOWN_FORMATS[type]
      )
    }
    return false
  }, COMMAND_PRIORITY_EDITOR)
}

const formatParagraph = () => {
  console.log('formatParagraph')
  const selection = $getSelection()
  $setBlocksType(selection, () => $createParagraphNode())
}

const formatHeading = (activeBlock, block) => {
  console.log('formatHeading', activeBlock, block)
  if (activeBlock === block) return
  const selection = $getSelection()
  $setBlocksType(selection, () => $createHeadingNode(block))
}

const formatBulletList = (editor, activeBlock, block) => {
  console.log('formatBulletList', activeBlock, block)
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

const formatQuote = (editor, activeBlock, block) => {
  if (activeBlock === block) return
  const selection = $getSelection()
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

export function registerSNFormatBlockCommand ({ editor }) {
  return editor.registerCommand(SN_FORMAT_BLOCK_COMMAND, ({ activeBlock, block }) => {
    switch (block) {
      case 'normal':
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
        formatQuote(editor, activeBlock, block)
        break
      case 'code':
        formatCodeBlock(editor, activeBlock, block)
        break
    }
  }, COMMAND_PRIORITY_EDITOR)
}
