import {
  $createMediaNode,
  $isMediaNode,
  MediaNode
} from '../../nodes/content/media/media'
import { $isMediaOrLinkNode } from '../../nodes/content/mediaorlink'

function escapeText (text) {
  return text.replace(/"/g, '\\"')
}

export const IMAGE = {
  dependencies: [MediaNode],
  export: (node, exportChildren, exportFormat) => {
    if (!$isMediaNode(node) && !$isMediaOrLinkNode(node)) {
      return null
    }
    if (node?.getKind?.() === 'unknown') {
      return `[${node.getSrc()}](${node.getSrc()})`
    }
    const base = `![${node.getAltText()}](${node.getSrc()}`
    let suffix = ')'
    if (node.getShowCaption()) {
      const caption = node.getCaptionText()
      if (caption) {
        // insert string at -1 position
        suffix = ` "${escapeText(caption)}")`
      }
    }
    return base + suffix
  },
  importRegExp: /!(?:\[([^[]*)\])(?:\(([^(]+?)(?:\s+"([^"]*)")?\))/,
  regExp: /!(?:\[([^[]*)\])(?:\(([^(]+?)(?:\s+"([^"]*)")?\))$/,
  replace: (textNode, match) => {
    const [, altText, src, captionText] = match
    const mediaNode = $createMediaNode({ altText, src, captionText, showCaption: !!captionText })
    textNode.replace(mediaNode)
  },
  trigger: ')',
  type: 'text-match'
}
