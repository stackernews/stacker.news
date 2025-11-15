import {
  $createMediaNode,
  $isMediaNode,
  MediaNode
} from '../../nodes/content/media'
import { exportMediaNode } from '../utils'

/** media transformer
 *
 *  rich mode: gets a media node and creates the appropriate markdown equivalent
 *
 *  markdown mode: from !\[alt text](src) to media node
 *
 */
export const MEDIA = {
  dependencies: [MediaNode],
  export: (node) => {
    if (!$isMediaNode(node)) {
      return null
    }
    if (node.getKind() === 'unknown') {
      return `[${node.getSrc()}](${node.getSrc()})`
    }
    return exportMediaNode(node)
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
