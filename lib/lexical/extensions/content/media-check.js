import { createCommand, defineExtension, COMMAND_PRIORITY_EDITOR, $getNodeByKey, $createTextNode } from 'lexical'
import { $createLinkNode } from '@lexical/link'
import { checkMedia } from '@/lib/media/check'
import { mergeRegister } from '@lexical/utils'
import { MediaNode } from '@/lib/lexical/nodes/content/media'
import { PUBLIC_MEDIA_CHECK_URL, UNKNOWN_LINK_REL } from '@/lib/constants'

export const MEDIA_CHECK_COMMAND = createCommand('MEDIA_CHECK_COMMAND')

export const MediaCheckExtension = defineExtension({
  name: 'MediaCheckExtension',
  register: (editor) => {
    const aborters = new Map()
    const tokens = new Map()
    const promises = new Map()

    // replaces a media node with a link node
    const replaceMediaWithLink = (node) => {
      const url = node.getSrc()
      const link = $createLinkNode(url, { target: '_blank', rel: UNKNOWN_LINK_REL })
      link.append($createTextNode(url))
      node.replace(link)
    }

    // checks media type and updates node accordingly
    const checkMediaNode = (nodeKey, url) => {
      if (promises.has(nodeKey)) {
        return promises.get(nodeKey)
      }

      const prev = aborters.get(nodeKey)
      if (prev) prev.abort()

      const token = (tokens.get(nodeKey) ?? 0) + 1
      tokens.set(nodeKey, token)

      // set node status to pending while checking
      editor.update(() => {
        const node = $getNodeByKey(nodeKey)
        if (node instanceof MediaNode) node.setStatus('pending')
      }, { tag: 'history-merge' })

      // create new abort controller for this request
      const controller = new AbortController()
      aborters.set(nodeKey, controller)

      const promise = checkMedia(PUBLIC_MEDIA_CHECK_URL, url, { signal: controller.signal })
        .then((result) => {
          if (tokens.get(nodeKey) !== token) return

          editor.update(() => {
            const node = $getNodeByKey(nodeKey)
            if (!(node instanceof MediaNode)) return

            if (result.type === 'unknown') {
              replaceMediaWithLink(node)
            } else {
              node.applyCheckResult(result.type)
            }
          }, { tag: 'history-merge' })
          return result
        })
        .catch((error) => {
          console.error('media check failed:', error)
          if (tokens.get(nodeKey) !== token) throw error

          editor.update(() => {
            const node = $getNodeByKey(nodeKey)
            if (node instanceof MediaNode) {
              node.setStatus('error')
              replaceMediaWithLink(node)
            }
          }, { tag: 'history-merge' })
        })
        .finally(() => {
          if (aborters.get(nodeKey) === controller) aborters.delete(nodeKey)
          promises.delete(nodeKey)
        })

      promises.set(nodeKey, promise)
      return promise
    }

    const unregisterTransforms = mergeRegister(
      // register command to check media type for a given node
      editor.registerCommand(MEDIA_CHECK_COMMAND, ({ nodeKey, url }) => {
        checkMediaNode(nodeKey, url)
        return true
      }, COMMAND_PRIORITY_EDITOR),
      // register transform to automatically check unknown media nodes
      editor.registerNodeTransform(MediaNode, (node) => {
        // trigger media check for unknown media nodes that are idle and have a source
        if (node.getKind() === 'unknown' && node.getStatus() === 'idle' && node.getSrc()) {
          editor.dispatchCommand(MEDIA_CHECK_COMMAND, { nodeKey: node.getKey(), url: node.getSrc() })
        }
      })
    )

    return () => {
      unregisterTransforms()
      aborters.forEach((controller) => controller.abort())
      aborters.clear()
      tokens.clear()
      promises.clear()
    }
  }
})
