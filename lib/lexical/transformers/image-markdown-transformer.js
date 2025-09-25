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
import { $isMediaOrLinkNode, $createMediaOrLinkNode } from '../nodes/mediaorlink'
import { MENTIONS } from './mentions'
import { TERRITORIES } from './territory'
import { LinkNode, $isLinkNode, $createLinkNode } from '@lexical/link'
import { $createTextNode } from 'lexical'
import { IMG_URL_REGEXP, VIDEO_URL_REGEXP, parseEmbedUrl } from '@/lib/url'
import { $createTweetNode } from '@/lib/lexical/nodes/embeds/tweet'
import { $createNostrNode } from '@/lib/lexical/nodes/embeds/nostr'
import { $createWavlakeNode } from '@/lib/lexical/nodes/embeds/wavlake'
import { $createSpotifyNode } from '@/lib/lexical/nodes/embeds/spotify'
import { $createYouTubeNode } from '@/lib/lexical/nodes/embeds/youtube'
import { $createRumbleNode } from '@/lib/lexical/nodes/embeds/rumble'
import { $createPeerTubeNode } from '@/lib/lexical/nodes/embeds/peertube'

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

// This is essentially a media or link transformer
// this should handle embeds, media and links
// TODO: there's so much repetition everywhere, and so much logic here...
// TODO: maybe there should be a single Embed node that handles all embeds
// TODO: or a media or link node that handles all embeds, media and links
export const BARE_LINK = {
  dependencies: [LinkNode],
  export: (node) => {
    if ($isLinkNode(node)) {
      return `[${node.getURL()}](${node.getURL()})`
    }
    return null
  },
  importRegExp: /(?<=^|\s)((https?:\/\/|www\.)\S+)/i,
  regExp: /(?<=^|\s)((https?:\/\/|www\.)\S+)/i,
  replace: (textNode, match) => {
    const url = match[1]
    const innerType = getInnerType(url)
    let newNode = null
    if (innerType.provider) {
      newNode = createEmbedNode(innerType)
    } else if (innerType !== 'link') {
      newNode = $createMediaOrLinkNode({ src: url, rel: 'noopener noreferrer', linkFallback: true })
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
    return embed
  }
  if (IMG_URL_REGEXP.test(src)) {
    return 'image'
  }
  if (VIDEO_URL_REGEXP.test(src)) {
    return 'video'
  }
  return 'link'
}

export const createEmbedNode = (embed) => {
  switch (embed.provider) {
    case 'twitter':
      return $createTweetNode(embed.id)
    case 'nostr':
      return $createNostrNode(embed.id)
    case 'wavlake':
      return $createWavlakeNode(embed.id)
    case 'spotify':
      return $createSpotifyNode(embed.id)
    case 'youtube':
      return $createYouTubeNode(embed.id, embed.meta)
    case 'rumble':
      return $createRumbleNode(embed.id, embed.meta)
    case 'peertube':
      return $createPeerTubeNode(embed.id, embed.meta)
  }
}

export const SN_TRANSFORMERS = [
  HR, IMAGE, MENTIONS, TERRITORIES, ...TRANSFORMERS
]
