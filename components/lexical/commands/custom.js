import { createCommand, COMMAND_PRIORITY_EDITOR, $getSelection, $isRangeSelection } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { mergeRegister } from '@lexical/utils'
import { TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $useMarkdownMode } from '../plugins/mode'

export const SN_TOGGLE_LINK_COMMAND = createCommand('SN_TOGGLE_LINK_COMMAND')

export default function CustomCommands () {
  const [editor] = useLexicalComposerContext()
  const markdownMode = $useMarkdownMode()

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(SN_TOGGLE_LINK_COMMAND, (url) => {
        console.log('SN_TOGGLE_LINK_COMMAND', url)
        if (!markdownMode) {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
          return true
        }

        // a mess, it checks if the selection is already a markdown link
        // if so, it extracts the text inside the [] and replaces the selection with it
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const text = selection.getTextContent()
          const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
          if (linkRegex.test(text)) {
            const match = text.match(linkRegex)
            if (match) {
              console.log('match', match)
              const linkText = match[0].match(/\[([^\]]*)\]/)[1] // extract text inside []
              console.log('linkText', linkText)
              selection.insertText(linkText)
            }
            return true
          }
          // if not, it creates a new markdown link
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
        }
        return true
      }, COMMAND_PRIORITY_EDITOR)
    )
  }, [editor, markdownMode])
  return null
}
