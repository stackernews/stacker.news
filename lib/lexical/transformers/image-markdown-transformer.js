import {
  $createImageNode,
  $isImageNode,
  ImageNode
} from '.././nodes/media/imagenode'
import { $isMediaOrLinkNode } from '../nodes/mediaorlink'

export const IMAGE = {
  dependencies: [ImageNode],
  export: (node, exportChildren, exportFormat) => {
    console.log('image transformer: node', node)
    if (!$isImageNode(node) && !$isMediaOrLinkNode(node)) {
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
    const imageNode = $createImageNode({ altText, src })
    textNode.replace(imageNode)
  },
  trigger: ')',
  type: 'text-match'
}
