import { $isMarkdownMode } from '@/lib/lexical/commands/utils'
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand } from 'lexical'
import { TOGGLE_LINK_COMMAND } from '@lexical/link'

export const SN_TOGGLE_LINK_COMMAND = createCommand('SN_TOGGLE_LINK_COMMAND')

export function registerSNToggleLinkCommand ({ editor }) {
  return editor.registerCommand(SN_TOGGLE_LINK_COMMAND, (url) => {
    const selection = $getSelection()
    const markdownMode = $isMarkdownMode()

    if (!markdownMode) {
      if ($isRangeSelection(selection) && !url) {
        const node = selection.anchor.getNode()
        const parent = node.getParent()
        if (parent && (parent.getType() === 'link' || parent.getType() === 'auto-ink')) {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
          return true
        }
      }
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
      return true
    }
    return true
  }, COMMAND_PRIORITY_EDITOR)
}
