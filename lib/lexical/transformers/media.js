import { LinkNode, $isLinkNode, $createLinkNode } from '@lexical/link'
import { $createTextNode } from 'lexical'
import { IMG_URL_REGEXP, VIDEO_URL_REGEXP, parseEmbedUrl } from '@/lib/url'
import { $createEmbedNode, $isEmbedNode, EmbedNodes } from '@/lib/lexical/nodes/embeds'
import { $isMediaNode, $createMediaNode, MediaNode } from '@/lib/lexical/nodes/media/media-node'
import { $isMediaOrLinkNode, MediaOrLinkNode } from '@/lib/lexical/nodes/mediaorlink'

function escapeText (text) {
  return text.replace(/"/g, '\\"')
}

// gets a link https://example.com and creates an embed/media/link node.
// gets an embed/media/link node and creates the appropriate markdown equivalent
// embeds are bare links
// media is ![alt text](src)
// links are [text](src)
export const MEDIA_OR_LINK = {
  dependencies: [LinkNode, MediaNode, MediaOrLinkNode, ...EmbedNodes],
  export: (node) => {
    console.log('media or link transformer: node', node)
    if ($isLinkNode(node)) {
      return `[${node.getFirstChild()?.getTextContent() || node.getURL()}](${node.getURL()})`
    }
    if ($isMediaNode(node)) {
      const base = `![${node.getAltText()}](${node.getSrc()}`
      let suffix = ')'
      if (node.getShowCaption()) {
        const caption = node.getCaptionText()
        if (caption) {
          suffix = ` "${escapeText(caption)}")`
        }
      }
      return base + suffix
    }
    if ($isEmbedNode(node) || $isMediaOrLinkNode(node)) {
      return node.getTextContent()
    }
    return null
  },
  importRegExp: /(?<=^|\s)((https?:\/\/|www\.)\S+)/i,
  regExp: /(?<=^|\s)((https?:\/\/|www\.)\S+)/i,
  replace: (textNode, match) => {
    console.log('media or link transformer: replace', textNode, match)
    const url = match[1]
    const innerType = getInnerType(url)
    let newNode = null
    if (innerType.provider) {
      newNode = $createEmbedNode(innerType)
    } else if (innerType === 'image' || innerType === 'video') {
      // if markdown is ![](src "caption")
      newNode = $createMediaNode({ src: url })
      // newNode = $createMediaOrLinkNode({ src: url, rel: 'noopener noreferrer', linkFallback: true })
    } else {
      const linkNode = $createLinkNode(url)
      linkNode.append($createTextNode(url))
      newNode = linkNode
    }
    textNode.replace(newNode)
  },
  type: 'text-match'
}

export const getInnerType = (src) => {
  const embed = parseEmbedUrl(src)
  if (embed) {
    return { ...embed, src }
  }
  if (IMG_URL_REGEXP.test(src)) {
    return 'image'
  }
  if (VIDEO_URL_REGEXP.test(src)) {
    return 'video'
  }
  return 'link'
}
