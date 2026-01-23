import { createCommand, defineExtension, COMMAND_PRIORITY_HIGH, $getSelection, $isRangeSelection } from 'lexical'
import { $insertMarkdown } from '@/lib/lexical/utils'
import { mergeRegister } from '@lexical/utils'

export const MD_FORMAT_COMMAND = createCommand('MD_FORMAT_COMMAND')
export const MD_INSERT_BLOCK_COMMAND = createCommand('MD_INSERT_BLOCK_COMMAND')

function $prefixEachLine (getPrefixFn) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return false

  const selectedText = selection.getTextContent()
  const lines = selectedText ? selectedText.split('\n') : ['']
  const markdown = lines.map((line, index) => getPrefixFn(line, index)).join('\n')
  $insertMarkdown(markdown)

  return true
}

function $wrapMarkdownSelection (prefix, suffix = prefix, cursorOffset = suffix.length) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return false

  const selectedText = selection.getTextContent()
  selection.insertText(`${prefix}${selectedText}${suffix}`)

  const newSelection = $getSelection()
  if ($isRangeSelection(newSelection)) {
    const anchor = newSelection.anchor
    const newOffset = anchor.offset - cursorOffset
    anchor.set(anchor.key, newOffset, anchor.type)
    newSelection.focus.set(anchor.key, newOffset, anchor.type)
  }
  return true
}

const FORMAT_HANDLERS = {
  bold: () => $wrapMarkdownSelection('**'),
  italic: () => $wrapMarkdownSelection('*'),
  link: () => $wrapMarkdownSelection('[', ']()', 1),
  quote: () => $prefixEachLine(line => `> ${line}`),
  code: () => $wrapMarkdownSelection('`'),
  superscript: () => $wrapMarkdownSelection('<sup>', '</sup>'),
  subscript: () => $wrapMarkdownSelection('<sub>', '</sub>'),
  strikethrough: () => $wrapMarkdownSelection('~~')
}

const LIST_PREFIXES = {
  number: (line, index) => `${index + 1}. ${line}`,
  check: (line) => `- [ ] ${line}`,
  bullet: (line) => `- ${line}`
}

const BLOCK_HANDLERS = {
  heading: (level = 1) => $prefixEachLine((line) => `${'#'.repeat(level)} ${line}`),
  list: (type = 'bullet') => $prefixEachLine(LIST_PREFIXES[type] || LIST_PREFIXES.bullet),
  codeblock: handleCodeblockCommand
}

function handleCodeblockCommand ({ language = 'text' } = {}) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return false

  const selectedText = selection.getTextContent()
  $insertMarkdown(`\`\`\`${language}\n${selectedText}\n\`\`\``, { line: 0, anchorOffset: 1 })
  return true
}

function handleMDFormatCommand (type) {
  return FORMAT_HANDLERS[type]?.() ?? false
}

function handleMDInsertBlockCommand ({ type, payload } = {}) {
  return BLOCK_HANDLERS[type]?.(payload) ?? false
}

export const MDCommandsExtension = defineExtension({
  name: 'MDCommandsExtension',
  register: (editor) => {
    return mergeRegister(
      editor.registerCommand(MD_FORMAT_COMMAND, handleMDFormatCommand, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(MD_INSERT_BLOCK_COMMAND, handleMDInsertBlockCommand, COMMAND_PRIORITY_HIGH)
    )
  }
})
