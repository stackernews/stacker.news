import { hasMarkdownFormat } from '../commands/formatting'
import { $getRoot } from 'lexical'
import { $isMarkdownNode } from '@/lib/lexical/nodes/markdownnode'
import { $isLinkNode } from '@lexical/link'
import { hasMarkdownLink } from '../commands/links'
import { getSelectedNode } from '../../utils/selection'

export function snHasFormat (selection, type) {
  if (!selection) return false
  const markdownMode = $isMarkdownMode()
  return markdownMode
    ? hasMarkdownFormat(selection, type)
    : selection.hasFormat(type)
}

export function snHasLink (selection) {
  if (!selection) return false
  const markdownMode = $isMarkdownMode()
  if (markdownMode) {
    return hasMarkdownLink(selection)
  }

  const node = getSelectedNode(selection)
  const parent = node.getParent()

  if ($isLinkNode(parent) || $isLinkNode(node)) {
    return true
  }
  return false
}

// only in editor reads and updates or commands
export function $isMarkdownMode () {
  const root = $getRoot()
  const firstChild = root.getFirstChild()
  return $isMarkdownNode(firstChild)
}
