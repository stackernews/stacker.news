import { $createEmbedNode, createNodeComparison, createEmbedNodeClass } from './embed'

export const SpotifyNode = createEmbedNodeClass('spotify')

export const { $isSpotifyNode } = createNodeComparison(SpotifyNode, 'spotify')

export function $createSpotifyNode (src) {
  return $createEmbedNode(SpotifyNode, { src })
}
