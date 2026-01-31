import { $isMarkdownMode } from '@/lib/lexical/commands/utils'
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand } from 'lexical'
import { TOGGLE_LINK_COMMAND, $isAutoLinkNode } from '@lexical/link'
import { USE_TRANSFORMER_BRIDGE } from '@/components/editor/plugins/core/transformer-bridge'
import { URL_REGEXP } from '@/lib/url'
import { MD_FORMAT_COMMAND } from '@/lib/lexical/commands/formatting/markdown'

export const SN_TOGGLE_LINK_COMMAND = createCommand('SN_TOGGLE_LINK_COMMAND')

export function $toggleLink (editor, url) {
  const selection = $getSelection()
  if (!selection) return false

  if ($isRangeSelection(selection) && !url) {
    const node = selection.anchor.getNode()
    const parent = node.getParent()
    if (parent && (parent.getType() === 'link' || parent.getType() === 'autolink')) {
      // already a link, toggle it off
      if ($isAutoLinkNode(parent)) {
        // TOGGLE_LINK_COMMAND doesn't handle AutoLinkNode,
        // in this case we need to unwrap it manually
        const children = parent.getChildren()
        for (const child of children) {
          parent.insertBefore(child)
        }
        parent.remove()
      } else {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      }
      return true
    } else {
      const text = selection.getTextContent()
      if (text) {
        // check if selection is a URL
        const isURL = URL_REGEXP.test(text)
        // TOGGLE_LINK_COMMAND needs a URL, we'll fallback to https:// if no URL is provided
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, isURL ? text : 'https://')
        return true
      }
    }
  }

  // toggle link on
  editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
  return true
}

export function registerSNToggleLinkCommand (editor) {
  return editor.registerCommand(SN_TOGGLE_LINK_COMMAND, (url) => {
    const markdownMode = $isMarkdownMode()
    const selection = $getSelection()

    // lexical rich mode toggle link
    if (!markdownMode) return $toggleLink(editor, url)

    // markdown mode toggle link via transformer bridge
    if (!$isRangeSelection(selection) || selection.isCollapsed()) {
      return editor.dispatchCommand(MD_FORMAT_COMMAND, 'link')
    }
    return editor.dispatchCommand(USE_TRANSFORMER_BRIDGE, { formatType: 'link', transformation: url })
  }, COMMAND_PRIORITY_EDITOR)
}
