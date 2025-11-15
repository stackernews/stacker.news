import { createEmbedNodeClass } from './embed'

export const PeerTubeNode = createEmbedNodeClass('peertube')

export function $isPeerTubeNode (node) {
  return node instanceof PeerTubeNode
}

export function $createPeerTubeNode (id, meta, src) {
  const node = new PeerTubeNode()
  node.setId(id)
  node.setMeta(meta)
  node.setSrc(src)
  return node
}
