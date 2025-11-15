import { createEmbedNodeClass } from './embed'

export const SpotifyNode = createEmbedNodeClass('spotify')

export function $isSpotifyNode (node) {
  return node instanceof SpotifyNode
}

export function $createSpotifyNode (src) {
  const node = new SpotifyNode()
  node.setSrc(src)
  return node
}
