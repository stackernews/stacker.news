import { $createEmbedNode, createNodeComparison, createEmbedNodeClass } from './embed'

export const WavlakeNode = createEmbedNodeClass('wavlake')

export const { $isWavlakeNode } = createNodeComparison(WavlakeNode, 'wavlake')

export function $createWavlakeNode (id, meta, src) {
  return $createEmbedNode(WavlakeNode, { id, meta, src })
}
