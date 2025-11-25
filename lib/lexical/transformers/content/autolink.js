import { LinkNode, $isLinkNode } from '@lexical/link'
import { AUTOLINK_URL_REGEXP, ensureProtocol, parseEmbedUrl } from '@/lib/url'
import { $createEmbedNode, $isEmbedNode, EmbedNodes } from '@/lib/lexical/nodes/content/embeds'
import { $isMediaNode, $createMediaNode, MediaNode } from '@/lib/lexical/nodes/content/media'
import { exportMediaNode } from '../utils'

/** media or link transformer
 *
 *  gets a link https://example.com and creates an embed/media/link node.
 *
 *  gets an embed/media/link node and creates the appropriate markdown equivalent
 *
 *  embeds are bare links
 *
 *  media is !\[alt text](src)
 *
 *  links are [text](src)
 *
 */
export const AUTOLINK = {
  dependencies: [LinkNode, MediaNode, ...EmbedNodes],
  export: (node) => {
    if ($isLinkNode(node)) {
      return `[${node.getFirstChild()?.getTextContent() || node.getURL()}](${node.getURL()})`
    }
    if ($isMediaNode(node)) {
      return exportMediaNode(node)
    }
    if ($isEmbedNode(node)) {
      return '\n' + node.getTextContent() + '\n'
    }
    return null
  },
  importRegExp: AUTOLINK_URL_REGEXP,
  regExp: AUTOLINK_URL_REGEXP,
  replace: (textNode, match) => {
    const url = match[0]
    const innerType = getInnerType(url)
    let newNode = null
    if (innerType.provider) {
      newNode = $createEmbedNode(innerType)
    } else {
      newNode = $createMediaNode({ src: url })
    }

    textNode.replace(newNode)
  },
  type: 'text-match'
}

export const getInnerType = (src) => {
  const href = ensureProtocol(src)
  const embed = parseEmbedUrl(href)
  return embed ? { ...embed, src: href } : 'url'
}
