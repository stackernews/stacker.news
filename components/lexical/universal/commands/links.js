import { createCommand, $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR } from 'lexical'
import { TOGGLE_LINK_COMMAND } from '@lexical/link'
import { getMarkdownMode } from '../utils/mode'

export const SN_TOGGLE_LINK_COMMAND = createCommand('SN_TOGGLE_LINK_COMMAND')

export function snToggleLinkCommand ({ editor }) {
  return editor.registerCommand(SN_TOGGLE_LINK_COMMAND, (url) => {
    const markdownMode = getMarkdownMode(editor)
    if (!markdownMode) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
      return true
    }
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) {
        // insert [text](url)
        const text = selection.getTextContent()
        const linkText = `[${text}](${url || ''})`
        selection.insertText(linkText)
        return true
      }
      // if it's a range selection, it checks if it's a markdown link
      const linkData = hasMarkdownLink(selection)
      if (linkData) {
        selection.insertText(linkData.text)
        return true
      }
      // if not, it creates a new markdown link
      const text = selection.getTextContent()
      const linkText = `[${text}](${url || ''})`
      selection.insertText(linkText)

      if (!url) {
        // Position cursor between the parentheses
        const { anchor } = selection
        const node = anchor.getNode()
        const offset = anchor.offset
        const parenPosition = offset - 1 // Position before the closing parenthesis
        selection.setTextNodeRange(node, parenPosition, node, parenPosition)
      }
      return true
    })
  }, COMMAND_PRIORITY_EDITOR)
}

export function hasMarkdownLink (selection) {
  const text = selection.getTextContent()
  // match [text](url)
  const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/
  const match = text.match(linkRegex)
  if (match) {
    return {
      text: match[1], // text inside brackets
      url: match[2], // url inside parentheses
      fullMatch: match[0] // full markdown link
    }
  }
  return null
}
