import { createEmbedNodeClass } from './embed'

export const WavlakeNode = createEmbedNodeClass('wavlake')

export function $isWavlakeNode (node) {
  return node instanceof WavlakeNode
}

export function $createWavlakeNode (id, meta, src) {
  const node = new WavlakeNode()
  node.setId(id)
  node.setMeta(meta)
  node.setSrc(src)
  return node
}
