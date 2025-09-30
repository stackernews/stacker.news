import {
  $createMediaNode,
  $isMediaNode,
  MediaNode
} from '../nodes/media/media-node'
import { $isMediaOrLinkNode } from '../nodes/mediaorlink'

export const IMAGE = {
  dependencies: [MediaNode],
  export: (node, exportChildren, exportFormat) => {
    console.log('image transformer: node', node)
    if (!$isMediaNode(node) && !$isMediaOrLinkNode(node)) {
      return null
    }
    console.log('node', node)
    if (node?.getInnerType?.() === 'link') {
      return `[${node.getSrc()}](${node.getSrc()})`
    }
    return `![${node.getAltText()}](${node.getSrc()})`
  },
  importRegExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))/,
  regExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))$/,
  replace: (textNode, match) => {
    console.log('image transformer: replace', textNode, match)
    const [, altText, src] = match
    const mediaNode = $createMediaNode({ altText, src })
    textNode.replace(mediaNode)
  },
  trigger: ')',
  type: 'text-match'
}
