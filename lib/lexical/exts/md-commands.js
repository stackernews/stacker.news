import { createCommand, defineExtension, COMMAND_PRIORITY_HIGH, $getSelection, $isRangeSelection } from 'lexical'
import { mergeRegister } from '@lexical/utils'
import { $insertMarkdown } from '@/lib/lexical/utils'

export const MD_FORMAT_COMMAND = createCommand('MD_FORMAT_COMMAND')
export const MD_INSERT_BLOCK_COMMAND = createCommand('MD_INSERT_BLOCK_COMMAND')
export const MD_INSERT_LINK_COMMAND = createCommand('MD_INSERT_LINK_COMMAND')
export const MD_INSERT_BOLD_COMMAND = createCommand('MD_INSERT_BOLD_COMMAND')
export const MD_INSERT_ITALIC_COMMAND = createCommand('MD_INSERT_ITALIC_COMMAND')
export const MD_INSERT_QUOTE_COMMAND = createCommand('MD_INSERT_QUOTE_COMMAND')
export const MD_INSERT_CODE_COMMAND = createCommand('MD_INSERT_CODE_COMMAND')
export const MD_INSERT_SUPERSCRIPT_COMMAND = createCommand('MD_INSERT_SUPERSCRIPT_COMMAND')
export const MD_INSERT_SUBSCRIPT_COMMAND = createCommand('MD_INSERT_SUBSCRIPT_COMMAND')
export const MD_INSERT_STRIKETHROUGH_COMMAND = createCommand('MD_INSERT_STRIKETHROUGH_COMMAND')
export const MD_INSERT_HEADING_COMMAND = createCommand('MD_INSERT_HEADING_COMMAND')
export const MD_INSERT_LIST_COMMAND = createCommand('MD_INSERT_LIST_COMMAND')
export const MD_INSERT_CODEBLOCK_COMMAND = createCommand('MD_INSERT_CODEBLOCK_COMMAND')

function $prefixEachLine (getPrefixFn) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return false

  const selectedText = selection.getTextContent()
  const lines = selectedText ? selectedText.split('\n') : ['']

  const prefixedLines = lines.map((line, index) => getPrefixFn(line, index))

  const markdown = prefixedLines.join('\n')
  $insertMarkdown(markdown)

  return true
}

function $wrapMarkdownSelection (prefix, suffix = prefix, cursorOffset = suffix.length) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return

  const selectedText = selection.getTextContent()

  // wrap the selected text with the prefix and suffix
  selection.insertText(`${prefix}${selectedText}${suffix}`)

  // position the cursor using the specified offset
  const newSelection = $getSelection()
  if ($isRangeSelection(newSelection)) {
    const anchor = newSelection.anchor
    const newOffset = anchor.offset - cursorOffset
    anchor.set(anchor.key, newOffset, anchor.type)
    newSelection.focus.set(anchor.key, newOffset, anchor.type)
  }
  // we return true to indicate that the command was handled
  return true
}

// format
function handleMDFormatCommand (type) {
  switch (type) {
    case 'bold':
      return handleMDInsertBoldCommand()
    case 'italic':
      return handleMDInsertItalicCommand()
    case 'link':
      return handleMDInsertLinkCommand()
    case 'quote':
      return handleMDInsertQuoteCommand()
    case 'code':
      return handleMDInsertCodeCommand()
    case 'superscript':
      return handleMDInsertSuperscriptCommand()
    case 'subscript':
      return handleMDInsertSubscriptCommand()
    case 'strikethrough':
      return handleMDInsertStrikethroughCommand()
    default:
      return false
  }
}

// blocks
function handleMDInsertBlockCommand ({ type, payload } = {}) {
  switch (type) {
    case 'heading':
      return handleMDInsertHeadingCommand(payload)
    case 'list':
      return handleMDInsertListCommand(payload)
    case 'codeblock':
      return handleMDInsertCodeblockCommand(payload)
    default:
      return false
  }
}

// bold
function handleMDInsertBoldCommand () {
  return $wrapMarkdownSelection('**')
}

// italic
function handleMDInsertItalicCommand () {
  return $wrapMarkdownSelection('*')
}

// link
function handleMDInsertLinkCommand () {
  return $wrapMarkdownSelection('[', ']()', 1)
}

// quote
function handleMDInsertQuoteCommand () {
  return $prefixEachLine(line => `> ${line}`)
}

// code
function handleMDInsertCodeCommand () {
  return $wrapMarkdownSelection('`')
}

// superscript
function handleMDInsertSuperscriptCommand () {
  return $wrapMarkdownSelection('<sup>', '</sup>')
}

// subscript
function handleMDInsertSubscriptCommand () {
  return $wrapMarkdownSelection('<sub>', '</sub>')
}

// strikethrough
function handleMDInsertStrikethroughCommand () {
  return $wrapMarkdownSelection('~~')
}

// heading
function handleMDInsertHeadingCommand (level = 1) {
  const hashes = '#'.repeat(level)
  return $prefixEachLine((line) => `${hashes} ${line}`)
}

// list (bullet, number, check)
function handleMDInsertListCommand (type = 'bullet') {
  return $prefixEachLine((line, index) => {
    switch (type) {
      case 'number':
        return `${index + 1}. ${line}`
      case 'check':
        return `- [ ] ${line}`
      case 'bullet':
      default:
        return `- ${line}`
    }
  })
}

// codeblock
function handleMDInsertCodeblockCommand ({ language = 'text' }) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return false

  const selectedText = selection.getTextContent()

  const codeblock = `\`\`\`${language}\n${selectedText}\n\`\`\``
  // inserts markdown at the current selection
  // and positions the cursor at the end of the first line to facilitate language selection
  $insertMarkdown(codeblock, { line: 0, anchorOffset: 1 })

  return true
}

export const MDCommandsExtension = defineExtension({
  name: 'MDCommandsExtension',
  register: (editor) => {
    return mergeRegister(
      editor.registerCommand(
        MD_FORMAT_COMMAND,
        handleMDFormatCommand,
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        MD_INSERT_BLOCK_COMMAND,
        handleMDInsertBlockCommand,
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        MD_INSERT_LINK_COMMAND,
        handleMDInsertLinkCommand,
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        MD_INSERT_BOLD_COMMAND,
        handleMDInsertBoldCommand,
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        MD_INSERT_ITALIC_COMMAND,
        handleMDInsertItalicCommand,
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        MD_INSERT_QUOTE_COMMAND,
        handleMDInsertQuoteCommand,
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        MD_INSERT_CODE_COMMAND,
        handleMDInsertCodeCommand,
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        MD_INSERT_SUPERSCRIPT_COMMAND,
        handleMDInsertSuperscriptCommand,
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        MD_INSERT_SUBSCRIPT_COMMAND,
        handleMDInsertSubscriptCommand,
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        MD_INSERT_STRIKETHROUGH_COMMAND,
        handleMDInsertStrikethroughCommand,
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        MD_INSERT_HEADING_COMMAND,
        handleMDInsertHeadingCommand,
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        MD_INSERT_LIST_COMMAND,
        handleMDInsertListCommand,
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        MD_INSERT_CODEBLOCK_COMMAND,
        handleMDInsertCodeblockCommand,
        COMMAND_PRIORITY_HIGH
      )
    )
  }
})
