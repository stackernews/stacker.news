import { $createEmbedNode, createNodeComparison, createEmbedNodeClass } from './embed'

export const NostrNode = createEmbedNodeClass('nostr')

export const { $isNostrNode } = createNodeComparison(NostrNode, 'nostr')

export function $createNostrNode (id, src) {
  return $createEmbedNode(NostrNode, { id, src })
}
