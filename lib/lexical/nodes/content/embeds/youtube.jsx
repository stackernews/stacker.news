import { $createEmbedNode, createNodeComparison, createEmbedNodeClass } from './embed'

export const YouTubeNode = createEmbedNodeClass('youtube')

export const { $isYouTubeNode } = createNodeComparison(YouTubeNode, 'youtube')

export function $createYouTubeNode (id, meta, src) {
  return $createEmbedNode(YouTubeNode, { id, meta, src })
}
