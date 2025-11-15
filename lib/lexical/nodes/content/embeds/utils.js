import { $createEmbedNode } from './index'

// to import embed elements from DOM
export function $convertEmbedElement (provider, domNode) {
  const id = domNode.getAttribute(`data-lexical-${provider}-id`)
  const src = domNode.getAttribute('data-lexical-embed-src')
  const metaString = domNode.getAttribute(`data-lexical-${provider}-meta`)
  let meta = null

  if (metaString) {
    try {
      meta = JSON.parse(metaString)
    } catch (e) {
      console.warn(`Failed to parse ${provider} embed meta:`, e)
    }
  }

  const node = $createEmbedNode({ provider, id, src, meta })
  return { node }
}
