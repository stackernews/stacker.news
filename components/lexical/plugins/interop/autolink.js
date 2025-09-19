import { ensureProtocol, URL_REGEXP, parseEmbedUrl } from '@/lib/url'
import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import { LinkNode, AutoLinkNode } from '@lexical/link'
import { $createMediaOrLinkNode } from '@/lib/lexical/nodes/mediaorlink'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW, $nodesOfType } from 'lexical'
import { $createTweetNode } from '@/lib/lexical/nodes/embeds/tweet'
import { $createNostrNode } from '@/lib/lexical/nodes/embeds/nostr'
import { $createWavlakeNode } from '@/lib/lexical/nodes/embeds/wavlake'
import { $createSpotifyNode } from '@/lib/lexical/nodes/embeds/spotify'
import { $createYouTubeNode } from '@/lib/lexical/nodes/embeds/youtube'
import { $createRumbleNode } from '@/lib/lexical/nodes/embeds/rumble'
import { $createPeerTubeNode } from '@/lib/lexical/nodes/embeds/peertube'

export const URL_MATCHERS = [
  (text) => {
    const match = URL_REGEXP.exec(text)
    if (!match) return null
    const raw = match[0]
    const url = ensureProtocol(raw)
    return {
      index: match.index,
      length: raw.length,
      text: raw,
      url
    }
  }
]

export default function CustomAutoLinkPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const selectionInsideNode = (node) => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return false
      const anchorNode = selection.anchor.getNode()
      const focusNode = selection.focus.getNode()
      return node.isParentOf(anchorNode) || node.isParentOf(focusNode) || node === anchorNode || node === focusNode
    }

    const onLinkTransform = (node) => {
      const url = node.getURL()
      const text = node.getTextContent()
      if (!url || !text) return
      const normUrl = ensureProtocol(url)
      const isRaw = text === url || ensureProtocol(text) === normUrl
      if (!isRaw) return
      if (selectionInsideNode(node)) return
      console.log('onLinkTransform', node)
      const rel = node.getRel?.() || UNKNOWN_LINK_REL
      // this is a complete mess, but weirdly works lmao
      const embed = parseEmbedUrl(normUrl)
      if (embed) {
        console.log('normUrl', normUrl)
        switch (embed.provider) {
          case 'twitter':
            node.replace($createTweetNode(embed.id))
            break
          case 'nostr':
            node.replace($createNostrNode(embed.id))
            break
          case 'wavlake':
            node.replace($createWavlakeNode(embed.id))
            break
          case 'spotify':
            node.replace($createSpotifyNode(embed.id))
            break
          case 'youtube':
            node.replace($createYouTubeNode(embed.id, embed.meta))
            break
          case 'rumble':
            node.replace($createRumbleNode(embed.id, embed.meta))
            break
          case 'peertube':
            node.replace($createPeerTubeNode(embed.id, embed.meta))
            break
          default:
            node.replace($createMediaOrLinkNode({ src: normUrl, rel, linkFallback: true }))
        }
      } else {
        node.replace($createMediaOrLinkNode({ src: normUrl, rel, linkFallback: true }))
      }
    }

    return mergeRegister(
      editor.registerNodeTransform(AutoLinkNode, onLinkTransform),
      editor.registerNodeTransform(LinkNode, onLinkTransform),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          editor.update(() => {
            const nodes = [...$nodesOfType(LinkNode), ...$nodesOfType(AutoLinkNode)]
            nodes.forEach(node => {
              onLinkTransform(node)
            })
          })
          return false
        },
        COMMAND_PRIORITY_LOW
      )
    )
  }, [editor])

  return null
}
