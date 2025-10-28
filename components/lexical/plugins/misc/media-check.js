import { createCommand, defineExtension, COMMAND_PRIORITY_EDITOR, $getNodeByKey, $createTextNode } from 'lexical'
import { $createLinkNode } from '@lexical/link'
import { checkMedia } from '@/lib/media/check'
import { mergeRegister } from '@lexical/utils'
import { MediaNode } from '@/lib/lexical/nodes/content/media/media'
import { PUBLIC_MEDIA_CHECK_URL } from '@/lib/constants'

export const MEDIA_CHECK_COMMAND = createCommand('MEDIA_CHECK_COMMAND')

export const MediaCheckExtension = defineExtension({
  name: 'MediaCheckExtension',
  register: (editor) => {
    // track abort controllers for each media node to cancel inflight requests
    const aborters = new Map() // node -> AbortController
    // track tokens to drop stale results from concurrent requests
    const tokens = new Map() // node -> token to drop stale results
    // track promises, these can be useful for waiting for all media checks to complete in some scenarios
    const promises = new Map() // nodeKey -> Promise

    // awaitable API for checking media
    const checkMediaNode = (nodeKey, url) => {
      // if there's already a promise for this node, return it
      if (promises.has(nodeKey)) {
        return promises.get(nodeKey)
      }

      // cancel any inflight requests for this media node
      const prev = aborters.get(nodeKey)
      if (prev) prev.abort()

      // increment token to invalidate any pending results
      const token = (tokens.get(nodeKey) ?? 0) + 1
      tokens.set(nodeKey, token)

      // set node status to pending while checking
      editor.update(() => {
        const node = $getNodeByKey(nodeKey)
        if (node instanceof MediaNode) node.setStatus('pending')
      })

      // create new abort controller for this request
      const controller = new AbortController()
      aborters.set(nodeKey, controller)

      // create promise for this check
      const promise = checkMedia(PUBLIC_MEDIA_CHECK_URL, url, { signal: controller.signal })
        .then((result) => {
          // ignore stale results
          if (tokens.get(nodeKey) !== token) return
          // update node with the check result
          editor.update(() => {
            const node = $getNodeByKey(nodeKey)
            if (!(node instanceof MediaNode)) return
            console.log('result', result)
            // if the media is unknown, at this point replace it with a link
            if (result.type === 'unknown') {
              const url = node.getSrc()
              const link = $createLinkNode(url)
              link.append($createTextNode(url))
              node.replace(link)
            } else {
              node.applyCheckResult(result.type)
            }
          })
          return result
        })
        .catch((error) => {
          console.error('error checking media', error)
          // ignore stale results
          if (tokens.get(nodeKey) !== token) throw error
          // set node status to error on failure
          editor.update(() => {
            const node = $getNodeByKey(nodeKey)
            if (node instanceof MediaNode) {
              node.setStatus('error')
              const url = node.getSrc()
              const link = $createLinkNode(url)
              link.append($createTextNode(url))
              node.replace(link)
            }
          })
        })
        .finally(() => {
          // clean up abort controller if it's still the current one
          if (aborters.get(nodeKey) === controller) aborters.delete(nodeKey)
          // clean up promise
          promises.delete(nodeKey)
        })

      promises.set(nodeKey, promise)
      return promise
    }

    // expose awaitable API on editor
    editor.checkMediaNode = checkMediaNode

    const unregister = mergeRegister(
      // register command to check media type for a given node (fire-and-forget)
      editor.registerCommand(MEDIA_CHECK_COMMAND, ({ nodeKey, url }) => {
        checkMediaNode(nodeKey, url)
        return true
      }, COMMAND_PRIORITY_EDITOR),
      // register transform to automatically check unknown media nodes
      editor.registerNodeTransform(MediaNode, (node) => {
        console.log('intercepted media node transform', node)
        // trigger media check for unknown media nodes that are idle and have a source
        if (node.getKind() === 'unknown' && node.getStatus() === 'idle' && node.getSrc()) {
          editor.dispatchCommand(MEDIA_CHECK_COMMAND, { nodeKey: node.getKey(), url: node.getSrc() })
        }
      })
    )
    return unregister
  }
})
