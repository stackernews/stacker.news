import { createEmbedNodeClass } from './embed'

export const NostrNode = createEmbedNodeClass('nostr')

export function $isNostrNode (node) {
  return node instanceof NostrNode
}

export function $createNostrNode (id, src) {
  const node = new NostrNode()
  node.setId(id)
  node.setSrc(src)
  return node
}
