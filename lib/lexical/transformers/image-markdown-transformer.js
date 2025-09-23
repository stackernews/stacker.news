import {
  $createImageNode,
  $isImageNode,
  ImageNode
} from '.././nodes/media/imagenode'
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode
} from '@lexical/react/LexicalHorizontalRuleNode'
import { TRANSFORMERS } from '@lexical/markdown'
import { $isMediaOrLinkNode } from '../nodes/mediaorlink'
import { MENTIONS } from './mentions'

export const IMAGE = {
  dependencies: [ImageNode],
  export: (node, exportChildren, exportFormat) => {
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
    const [, altText, src] = match
    const imageNode = $createImageNode({ altText, src })
    textNode.replace(imageNode)
  },
  trigger: ')',
  type: 'text-match'
}

export const HR = {
  dependencies: [HorizontalRuleNode],
  export: (node) => {
    return $isHorizontalRuleNode(node) ? '***' : null
  },
  regExp: /^(-{3,}|\*{3,}|_{3,})\s?$/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createHorizontalRuleNode()

    // TODO: Get rid of isImport flag
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line)
    } else {
      parentNode.insertBefore(line)
    }

    line.selectNext()
  },
  type: 'element'
}

export const SN_TRANSFORMERS = [
  HR, IMAGE, MENTIONS, ...TRANSFORMERS
]
