import { $createEmbedNode, createNodeComparison, createEmbedNodeClass } from './embed'

export const PeerTubeNode = createEmbedNodeClass('peertube')

export const { $isPeerTubeNode } = createNodeComparison(PeerTubeNode, 'peertube')

export function $createPeerTubeNode (id, meta, src) {
  return $createEmbedNode(PeerTubeNode, { id, meta, src })
}
