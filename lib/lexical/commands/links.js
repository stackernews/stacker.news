import { isMarkdownMode } from '@/lib/lexical/commands/utils'
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand, $createTextNode } from 'lexical'
import { TOGGLE_LINK_COMMAND, $isAutoLinkNode } from '@lexical/link'
import { USE_TRANSFORMER_BRIDGE } from '@/components/editor/plugins/core/transformer-bridge'
import { URL_REGEXP } from '@/lib/url'
import { MD_FORMAT_COMMAND } from '@/lib/lexical/commands/formatting/markdown'
import { $moveSelection } from '@/lib/lexical/utils'
import { hasMarkdownLink } from '@/lib/md'
import { $isItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item'

const DEFAULT_URL = 'https://'

export const SN_TOGGLE_LINK_COMMAND = createCommand('SN_TOGGLE_LINK_COMMAND')

function getURLFromSelection (selection) {
  if (!$isRangeSelection(selection) || selection.isCollapsed()) return null

  const text = selection.getTextContent()
  const isURL = URL_REGEXP.test(text)
  return isURL ? text : DEFAULT_URL
}

export function $toggleLink (editor, url) {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || selection.isCollapsed()) return false

  if (!url) {
    const node = selection.anchor.getNode()
    const firstChild = node?.getFirstChild?.() || null
    const parent = node?.getParent?.() || null
    if (parent?.getType() === 'link' || parent?.getType() === 'autolink') {
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
    } else if ($isItemMentionNode(firstChild)) {
      // if the first child is an ItemMentionNode, replace it with a text node
      const text = firstChild.getText()
      const textNode = $createTextNode(text)
      firstChild.replace(textNode)
      return true
    } else {
      const url = getURLFromSelection(selection)
      if (url) {
        // TOGGLE_LINK_COMMAND needs a URL, we'll fallback to https:// if no URL is provided
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
        return true
      }
    }
  }

  // toggle link on
  editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
  return true
}

function $toggleLinkCommand (editor, url) {
  const isMarkdown = isMarkdownMode(editor)
  const selection = $getSelection()

  // lexical rich mode toggle link
  if (!isMarkdown) return $toggleLink(editor, url)

  // markdown mode
  // if no real selection, fallback to simple markdown link insertion
  if (!$isRangeSelection(selection) || selection.isCollapsed()) {
    return editor.dispatchCommand(MD_FORMAT_COMMAND, 'link')
  }

  // capture markdown before transformation
  const markdown = selection.getTextContent()
  const alreadyLink = hasMarkdownLink(markdown)
  const linkUrl = url || getURLFromSelection(selection)

  // transformer bridge
  const handled = editor.dispatchCommand(USE_TRANSFORMER_BRIDGE, { formatType: 'link', transformation: alreadyLink ? null : linkUrl })
  if (!handled || alreadyLink) return handled

  // adjust selection to either select the alt text or the URL placeholder
  const updatedSelection = $getSelection()
  if (!updatedSelection) return handled

  // XXX: arbitrary selection logic,
  // it's the fastest way to get a backwards selection right, also considering we own the pipeline
  if (linkUrl !== DEFAULT_URL) {
    // select the alt text inside the square brackets
    $moveSelection(
      updatedSelection,
      -(linkUrl.length + linkUrl.length + 3),
      -(linkUrl.length + 3)
    )
  } else {
    // select the URL placeholder inside the parenthesis
    $moveSelection(updatedSelection, -(linkUrl.length + 1), -1)
  }
  return true
}

export function registerSNToggleLinkCommand (editor) {
  return editor.registerCommand(
    SN_TOGGLE_LINK_COMMAND,
    (url) => $toggleLinkCommand(editor, url),
    COMMAND_PRIORITY_EDITOR
  )
}
