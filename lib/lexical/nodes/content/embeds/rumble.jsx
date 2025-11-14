import { $createEmbedNode, createNodeComparison, createEmbedNodeClass } from './embed'

export const RumbleNode = createEmbedNodeClass('rumble')

export const { $isRumbleNode } = createNodeComparison(RumbleNode, 'rumble')

export function $createRumbleNode (id, meta, src) {
  return $createEmbedNode(RumbleNode, { id, meta, src })
}
