import { ensureProtocol, URL_REGEXP } from '@/lib/url'
import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import { LinkNode, AutoLinkNode } from '@lexical/link'
import { $createMediaOrLinkNode } from '@/lib/lexical/nodes/mediaorlink'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW, $nodesOfType } from 'lexical'
import { $createTweetNode } from '@/lib/lexical/nodes/embeds/tweet'

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

export default function MediaOrLinkPlugin () {
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
      // this has to be separated from media or link and it's just a proof of concept
      if (normUrl.startsWith('https://x.com')) {
        console.log('normUrl', normUrl)
        const tweetId = normUrl.split('/').pop()
        const tweetNode = $createTweetNode(tweetId)
        node.replace(tweetNode)
      } else {
        const mediaNode = $createMediaOrLinkNode({ src: normUrl, rel, linkFallback: true })
        node.replace(mediaNode)
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
