import { createEmbedNodeClass } from './embed'

export const RumbleNode = createEmbedNodeClass('rumble')

export function $isRumbleNode (node) {
  return node instanceof RumbleNode
}

export function $createRumbleNode (id, meta, src) {
  const node = new RumbleNode()
  node.setId(id)
  node.setMeta(meta)
  node.setSrc(src)
  return node
}
