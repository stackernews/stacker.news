import { $createEmbedNode, createNodeComparison, createEmbedNodeClass } from './embed'

export const TweetNode = createEmbedNodeClass('twitter')

export const { $isTweetNode } = createNodeComparison(TweetNode, 'twitter')

export function $createTweetNode (id, src) {
  return $createEmbedNode(TweetNode, { id, src })
}
