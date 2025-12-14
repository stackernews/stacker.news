import { createCommand, defineExtension, COMMAND_PRIORITY_HIGH, $getSelection, $isRangeSelection } from 'lexical'
import { mergeRegister } from '@lexical/utils'

export const MD_INSERT_LINK_COMMAND = createCommand('MD_INSERT_LINK_COMMAND')
export const MD_INSERT_BOLD_COMMAND = createCommand('MD_INSERT_BOLD_COMMAND')
export const MD_INSERT_ITALIC_COMMAND = createCommand('MD_INSERT_ITALIC_COMMAND')

function wrapMarkdownSelection (editor, prefix, suffix = prefix, cursorOffset = suffix.length) {
  editor.update(() => {
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
  })
}

// bold
function handleMDInsertBoldCommand (editor) {
  wrapMarkdownSelection(editor, '**')
  return true
}

// italic
function handleMDInsertItalicCommand (editor) {
  wrapMarkdownSelection(editor, '*')
  return true
}

// link
function handleMDInsertLinkCommand (editor) {
  wrapMarkdownSelection(editor, '[', ']()', 1)
  return true
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
      )
    )
  }
})
