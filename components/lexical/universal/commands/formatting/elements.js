import { createCommand, COMMAND_PRIORITY_EDITOR, FORMAT_ELEMENT_COMMAND, $getSelection, $isRangeSelection } from 'lexical'
import { $isMarkdownMode } from '@/components/lexical/universal/utils'
export const SN_FORMAT_ELEMENT_COMMAND = createCommand('SN_FORMAT_ELEMENT_COMMAND')

// mhh.... I think we need to have some functions like

// something to toggle aligns
function toggleAlignMarkdown (selection, align) {
  const text = selection.getTextContent()

  // Check if text already has div align tags
  const alignRegex = /<div align="([^"]*)">(.*)<\/div>/s
  const match = text.match(alignRegex)

  if (match) {
    const [, currentAlign, content] = match
    // If same alignment, remove tags; otherwise change alignment
    const newText = currentAlign === align
      ? content
      : `<div align="${align}">${content}</div>`
    selection.insertText(newText)
  } else {
    // No existing tags, add new ones
    const newText = `<div align="${align}">${text}</div>`
    selection.insertText(newText)
  }
}

// something to toggle lists
// function toggleListMarkdown

// something to toggle code blocks
// function toggleFencedCodeMarkdown

export const registerSNFormatElementCommand = ({ editor }) => {
  return editor.registerCommand(SN_FORMAT_ELEMENT_COMMAND, (align) => {
    const isMarkdownMode = $isMarkdownMode()
    if (!isMarkdownMode) {
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align)
      return true
    }
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    toggleAlignMarkdown(selection, align)
    return true
  }, COMMAND_PRIORITY_EDITOR)
}
