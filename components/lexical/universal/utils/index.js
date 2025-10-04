import { hasMarkdownFormat } from '../commands/formatting'
import { $isMarkdownMode } from './mode'
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
