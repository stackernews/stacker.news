import { createCommand, $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR } from 'lexical'
import { TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $isMarkdownMode } from '../utils'

/** command to toggle link in markdown and rich text mode
 * @param {string} url - link URL, if empty/null and we're in a link, removes it
 * @returns {boolean} true if command was handled
 */
export const SN_TOGGLE_LINK_COMMAND = createCommand('SN_TOGGLE_LINK_COMMAND')

/**
 * registers command to toggle link in markdown and rich text mode
 * @param {Object} params.editor - lexical editor instance
 * @returns {Function} unregister function
 */
export function registerSNToggleLinkCommand ({ editor }) {
  return editor.registerCommand(SN_TOGGLE_LINK_COMMAND, (url) => {
    const selection = $getSelection()
    const markdownMode = $isMarkdownMode()

    if (!markdownMode) {
      // if url is empty/null and we're in a link, remove it
      // else add/update the link
      if ($isRangeSelection(selection) && !url) {
        const node = selection.anchor.getNode()
        const parent = node.getParent()
        if (parent && (parent.getType() === 'link' || parent.getType() === 'autolink')) {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
          return true
        }
      }
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
      return true
    }

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
  }, COMMAND_PRIORITY_EDITOR)
}

/**
 * checks if selection contains a markdown link and extracts its text, url, and full match
 * @param {Object} selection - lexical selection object
 * @returns {Object|null} object with text, url, and fullMatch properties, or null
 */
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
