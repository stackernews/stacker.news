import { $getNodeByKey, $nodesOfType, $createTextNode } from 'lexical'
import { $createLinkNode } from '@lexical/link'
import { MediaNode } from '@/lib/lexical/nodes/content/media'
import { batchedCheckMedia } from '@/lib/media/check'
import { UNKNOWN_LINK_REL } from '@/lib/constants'

/** checks media nodes in batches
 * @param {Object} editor - lexical editor instance
 * @returns {Promise<void>} void
 */
export async function $ssrCheckMediaNodes (editor) {
  // get all the urls from the media nodes
  const keys = []
  const urls = []
  editor.read(() => {
    $nodesOfType(MediaNode).forEach(node => {
      if (node.getKind() !== 'unknown' || node.getStatus() === 'done' || !node.getSrc()) return
      keys.push(node.getKey())
      urls.push(node.getSrc())
    })
  })
  // check media nodes in batches
  if (urls.length === 0) return
  const map = await batchedCheckMedia(urls)
  // apply the results to the media nodes
  editor.update(() => {
    for (const key of keys) {
      const node = $getNodeByKey(key)
      if (node instanceof MediaNode) {
        const result = map.get(node.getSrc())
        if (result) {
          const kind = result.type
          if (kind === 'unknown') {
            const url = node.getSrc()
            const link = $createLinkNode(url, { target: '_blank', rel: UNKNOWN_LINK_REL })
            link.append($createTextNode(url))
            node.replace(link)
          } else {
            node.applyCheckResult(kind)
          }
        }
      }
    }
  })
}
