import { createEmbedNodeClass } from './embed'

export const YouTubeNode = createEmbedNodeClass('youtube')

export function $createYouTubeNode (id, meta, src) {
  const node = new YouTubeNode()
  node.setId(id)
  node.setMeta(meta)
  node.setSrc(src)
  return node
}

export function $isYouTubeNode (node) {
  return node instanceof YouTubeNode
}
