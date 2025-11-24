import { createCommand, defineExtension, COMMAND_PRIORITY_EDITOR, $getNodeByKey, $createTextNode } from 'lexical'
import { $createLinkNode } from '@lexical/link'
import { mergeRegister } from '@lexical/utils'
import { MediaNode } from '@/lib/lexical/nodes/content/media'
import { PUBLIC_MEDIA_CHECK_URL, UNKNOWN_LINK_REL } from '@/lib/constants'
import { fetchWithTimeout } from '@/lib/fetch'

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

/**
 * checks if a URL points to video or image by calling media check endpoint
 * @param {string} endpoint - media check endpoint URL
 * @param {string} url - URL to check
 * @param {Object} [options] - options object
 * @param {AbortSignal} [options.signal] - abort signal for request cancellation
 * @returns {Promise<Object>} object with type property ('video', 'image', or 'unknown')
 */
export async function checkMedia (endpoint, url, { signal } = {}) {
  try {
    const res = await fetchWithTimeout(`${endpoint}/${encodeURIComponent(url)}`, { signal, timeout: 10000 })
    if (!res.ok) throw new Error('failed to check media')
    const json = await res.json()
    console.log('media check response:', json)
    if (!json || (json.isVideo === undefined || json.isImage === undefined)) throw new Error('invalid media check response')
    // the fetch would return mime, isVideo, isImage
    const type = json.isVideo ? 'video' : json.isImage ? 'image' : 'unknown'
    return { type }
  } catch (error) {
    console.error('error checking media', error)
    return { type: 'unknown' }
  }
}

/**
 * checks multiple URLs concurrently with configurable concurrency limit
 * @param {string[]} urls - array of URLs to check
 * @param {Object} [options] - options object
 * @param {number} [options.concurrency=8] - maximum number of concurrent requests
 * @param {AbortSignal} [options.signal] - abort signal for request cancellation
 * @returns {Promise<Map>} map of URL to check result objects
 */
export async function batchedCheckMedia (urls, { concurrency = 8, signal } = {}) {
  console.log('batchedCheckMedia urls:', urls)
  const queue = Array.from(new Set(urls)).filter(Boolean)
  const results = new Map()

  async function worker () {
    while (queue.length > 0) {
      const url = queue.shift()
      if (!url) break

      try {
        const result = await checkMedia(process.env.MEDIA_CHECK_URL_DOCKER || process.env.NEXT_PUBLIC_MEDIA_CHECK_URL, url, { signal })
        results.set(url, result)
      } catch (error) {
        console.error('error checking media', error)
        results.set(url, { type: 'unknown' })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
  return results
}
