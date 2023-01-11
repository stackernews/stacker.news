import { $getSelection, $getTextContent, $isRangeSelection } from 'lexical'
import { getSelectedNode } from './selected-node'
import { $isLinkNode } from '@lexical/link'

export function getLinkFromSelection () {
  const selection = $getSelection()
  let url = ''
  let text = ''
  if ($isRangeSelection(selection)) {
    const node = getSelectedNode(selection)
    const parent = node.getParent()
    if ($isLinkNode(parent)) {
      url = parent.getURL()
      text = parent.getTextContent()
    } else if ($isLinkNode(node)) {
      url = node.getURL()
      text = node.getTextContent()
    } else {
      url = ''
      text = $getTextContent(selection)
    }
  }
  return { url, text }
}
