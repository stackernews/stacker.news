import { createCommand, defineExtension, COMMAND_PRIORITY_HIGH, $getSelection, $isRangeSelection } from 'lexical'
import { mergeRegister } from '@lexical/utils'

export const MD_INSERT_LINK_COMMAND = createCommand('MD_INSERT_LINK_COMMAND')
export const MD_INSERT_BOLD_COMMAND = createCommand('MD_INSERT_BOLD_COMMAND')
export const MD_INSERT_ITALIC_COMMAND = createCommand('MD_INSERT_ITALIC_COMMAND')
export const MD_INSERT_QUOTE_COMMAND = createCommand('MD_INSERT_QUOTE_COMMAND')
export const MD_INSERT_CODE_COMMAND = createCommand('MD_INSERT_CODE_COMMAND')
export const MD_INSERT_SUPERSCRIPT_COMMAND = createCommand('MD_INSERT_SUPERSCRIPT_COMMAND')
export const MD_INSERT_SUBSCRIPT_COMMAND = createCommand('MD_INSERT_SUBSCRIPT_COMMAND')
export const MD_INSERT_STRIKETHROUGH_COMMAND = createCommand('MD_INSERT_STRIKETHROUGH_COMMAND')

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
  return $wrapMarkdownSelection('> ', '')
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

export const MDCommandsExtension = defineExtension({
  name: 'MDCommandsExtension',
  register: (editor) => {
    return mergeRegister(
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
      )
    )
  }
})
