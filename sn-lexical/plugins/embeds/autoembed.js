import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { INSERT_TWEET_COMMAND } from './twitter'
import { mergeRegister } from '@lexical/utils'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW, $nodesOfType } from 'lexical'
import { ensureProtocol } from '@/lib/url'

const TwitterEmbedConfig = {
  contentName: 'Twitter',
  exampleUrl: 'https://x.com/i/web/status/1234567890',
  icon: null,
  insertNode: (editor, result) => {
    editor.dispatchCommand(INSERT_TWEET_COMMAND, result.id)
  },
  keywords: ['twitter', 'x', 'tweet'],
  parseUrl: (text) => {
    const match = /^https:\/\/(twitter|x)\.com\/(#!\/)?(\w+)\/status(es)*\/(\d+)/.exec(text)
    if (!match) return null
    return {
      id: match[5],
      url: match[1]
    }
  },
  type: 'tweet'
}

const EmbedConfigs = [
  TwitterEmbedConfig
]

export default function AutoEmbedPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const selectionInsideNode = (node) => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return false
      const anchorNode = selection.anchor.getNode()
      const focusNode = selection.focus.getNode()
      return node.isParentOf(anchorNode) || node.isParentOf(focusNode) || node === anchorNode || node === focusNode
    }

    const onEmbedTransform = (node) => {
      const url = node.getURL()
      const text = node.getTextContent()
      if (!url || !text) return
      const normUrl = ensureProtocol(url)
      const isRaw = text === url || ensureProtocol(text) === normUrl
      if (!isRaw) return
      if (selectionInsideNode(node)) return
      const result = EmbedConfigs.find(config => config.parseUrl(normUrl))
      if (result) {
        node.replace(result.insertNode(editor, result))
      }
    }

    return mergeRegister(
      editor.registerNodeTransform(AutoLinkNode, onEmbedTransform),
      editor.registerNodeTransform(LinkNode, onEmbedTransform),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          editor.update(() => {
            const nodes = [...$nodesOfType(AutoLinkNode), ...$nodesOfType(LinkNode)]
            nodes.forEach(node => {
              onEmbedTransform(node)
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
