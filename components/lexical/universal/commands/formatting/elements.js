import { createCommand, COMMAND_PRIORITY_EDITOR, FORMAT_ELEMENT_COMMAND } from 'lexical'
export const SN_FORMAT_ELEMENT_COMMAND = createCommand('SN_FORMAT_ELEMENT_COMMAND')

// mhh.... I think we need to have some functions like

// something to toggle aligns
// function toggleAlignMarkdown

// something to toggle lists
// function toggleListMarkdown

// something to toggle code blocks
// function toggleFencedCodeMarkdown

export const registerSNFormatElementCommand = ({ editor }) => {
  return editor.registerCommand(SN_FORMAT_ELEMENT_COMMAND, (align) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align)
  }, COMMAND_PRIORITY_EDITOR)
}
