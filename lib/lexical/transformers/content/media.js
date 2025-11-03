import {
  $createMediaNode,
  $isMediaNode,
  MediaNode
} from '../../nodes/content/media/media'

function escapeText (text) {
  return text.replace(/"/g, '\\"')
}

export const IMAGE = {
  dependencies: [MediaNode],
  export: (node, exportChildren, exportFormat) => {
    if (!$isMediaNode(node)) {
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
    const { width, height } = node.getWidthAndHeight()
    if (Number(width) > 0 && Number(height) > 0) {
      suffix += `{width:${width},height:${height}}`
    }
    return base + suffix
  },
  importRegExp: /!(?:\[([^[]*)\])(?:\(([^(]+?)(?:\s+"([^"]*)")?\))(?:\{width:([^,}]+),height:([^}]+)\})?/,
  regExp: /!(?:\[([^[]*)\])(?:\(([^(]+?)(?:\s+"([^"]*)")?\))(?:\{width:([^,}]+),height:([^}]+)\})?$/,
  replace: (textNode, match) => {
    const [, altText, src, captionText, width, height] = match
    const mediaNode = $createMediaNode({ altText, src, captionText, showCaption: !!captionText, width, height })
    textNode.replace(mediaNode)
  },
  trigger: ')',
  type: 'text-match'
}
