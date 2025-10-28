import { LinkNode, $isLinkNode } from '@lexical/link'
import { parseEmbedUrl } from '@/lib/url'
import { $createEmbedNode, $isEmbedNode, EmbedNodes } from '@/lib/lexical/nodes/content/embeds'
import { $isMediaNode, $createMediaNode, MediaNode } from '@/lib/lexical/nodes/content/media/media'
import { $isMediaOrLinkNode, MediaOrLinkNode } from '@/lib/lexical/nodes/content/mediaorlink'
import { $createTextNode } from 'lexical'

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
    if ($isLinkNode(node)) {
      return `[${node.getFirstChild()?.getTextContent() || node.getURL()}](${node.getURL()})`
    }
    if ($isMediaNode(node)) {
      if (node.getShowCaption()) {
        const caption = node.getCaptionText()
        const escapedCaption = escapeText(caption)
        if (escapedCaption) {
          return `![${node.getAltText() || escapedCaption}](${node.getSrc()} "${escapedCaption}")`
        }
      }
      return `![${node.getAltText() || ''}](${node.getSrc()})`
    }
    if ($isEmbedNode(node) || $isMediaOrLinkNode(node)) {
      return node.getTextContent()
    }
    return null
  },
  importRegExp: /(?:^|\s)(https?:\/\/[^\s]+)/,
  regExp: /(?:^|\s)(https?:\/\/[^\s]+)$/,
  replace: (textNode, match) => {
    const [fullMatch, url] = match
    const innerType = getInnerType(url)
    let newNode = null
    if (innerType.provider) {
      newNode = $createEmbedNode(innerType)
    } else {
      newNode = $createMediaNode({ src: url })
    }

    // preserve whitespace to compensate for the regexp
    const startsWithSpace = fullMatch.startsWith(' ')
    textNode.replace(newNode)
    if (startsWithSpace) {
      newNode.insertBefore($createTextNode(' '))
    }
  },
  type: 'text-match'
}

export const getInnerType = (src) => {
  const embed = parseEmbedUrl(src)
  return embed ? { ...embed, src } : 'url'
}
