import { $isMarkdownMode } from '@/lib/lexical/commands/utils'
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand } from 'lexical'
import { TOGGLE_LINK_COMMAND } from '@lexical/link'
import { USE_TRANSFORMER_BRIDGE } from '@/components/editor/plugins/core/transformer-bridge'

export const SN_TOGGLE_LINK_COMMAND = createCommand('SN_TOGGLE_LINK_COMMAND')

export function $toggleLink (editor, url) {
  const selection = $getSelection()
  if (!selection) return false

  if ($isRangeSelection(selection) && !url) {
    const node = selection.anchor.getNode()
    const parent = node.getParent()
    if (parent && (parent.getType() === 'link' || parent.getType() === 'autolink')) {
      // already a link, toggle it off
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      return true
    } else {
      // check if selection is a URL
      const text = selection.getTextContent()
      if (text) {
        const isURL = true // TODO: implement URL detection
        if (isURL) {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, text)
          return true
        } else {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, { url: 'https://', title: text })
          return true
        }
      }
    }
  }

  // toggle link on
  editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
  return true
}

export function registerSNToggleLinkCommand ({ editor }) {
  return editor.registerCommand(SN_TOGGLE_LINK_COMMAND, (url) => {
    const markdownMode = $isMarkdownMode()

    const selection = $getSelection()
    const text = selection.getTextContent()
    if (text) {
      const isURL = true // TODO: implement URL detection
      if (isURL) {
        return $toggleLink(editor, url)
      }
    }

    // lexical rich mode toggle link
    if (!markdownMode) return $toggleLink(editor, url)

    // markdown mode toggle link via transformer bridge
    return editor.dispatchCommand(USE_TRANSFORMER_BRIDGE, { formatType: 'link', transformation: url })
  }, COMMAND_PRIORITY_EDITOR)
}
