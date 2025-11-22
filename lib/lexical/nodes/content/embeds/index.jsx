import { $createNostrNode, NostrNode } from '@/lib/lexical/nodes/content/embeds/nostr'
import { $createPeerTubeNode, PeerTubeNode } from '@/lib/lexical/nodes/content/embeds/peertube'
import { $createRumbleNode, RumbleNode } from '@/lib/lexical/nodes/content/embeds/rumble'
import { $createSpotifyNode, SpotifyNode } from '@/lib/lexical/nodes/content/embeds/spotify'
import { $createTweetNode, TweetNode } from '@/lib/lexical/nodes/content/embeds/tweet'
import { $createWavlakeNode, WavlakeNode } from '@/lib/lexical/nodes/content/embeds/wavlake'
import { $createYouTubeNode, YouTubeNode } from '@/lib/lexical/nodes/content/embeds/youtube'

/**
 * creates the appropriate embed node by provider name
 * @param {string} params.provider - embed provider ('twitter', 'youtube', 'nostr', etc.)
 * @param {string} [params.src] - source URL
 * @param {string} [params.id] - provider-specific content ID
 * @param {Object} [params.meta] - additional metadata, e.g. youtube start time
 * @returns {Object} lexical embed node
 */
export function $createEmbedNode ({ provider, src = null, id = null, meta = null }) {
  switch (provider) {
    case 'twitter':
      return $createTweetNode(id, src)
    case 'nostr':
      return $createNostrNode(id, src)
    case 'wavlake':
      return $createWavlakeNode(id, src)
    case 'spotify':
      return $createSpotifyNode(src)
    case 'youtube':
      return $createYouTubeNode(id, meta, src)
    case 'rumble':
      return $createRumbleNode(id, meta, src)
    case 'peertube':
      return $createPeerTubeNode(id, meta, src)
  }
}

/**
 * universal embed node check
 * @param {Object} node - lexical node to check
 * @returns {boolean} true if node is an embed node
 */
export function $isEmbedNode (node) {
  return node instanceof TweetNode ||
         node instanceof NostrNode ||
         node instanceof RumbleNode ||
         node instanceof WavlakeNode ||
         node instanceof SpotifyNode ||
         node instanceof YouTubeNode ||
         node instanceof PeerTubeNode
}

export const EmbedNodes = [
  TweetNode,
  NostrNode,
  RumbleNode,
  WavlakeNode,
  SpotifyNode,
  YouTubeNode,
  PeerTubeNode
]
