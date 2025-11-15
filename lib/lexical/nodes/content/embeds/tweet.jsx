import { createEmbedNodeClass } from './embed'

export const TweetNode = createEmbedNodeClass('twitter')

export function $isTweetNode (node) {
  return node instanceof TweetNode
}

export function $createTweetNode (id, src) {
  const node = new TweetNode()
  node.setId(id)
  node.setSrc(src)
  return node
}
