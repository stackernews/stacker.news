import { cachedFetcher } from '@/lib/fetch'
import { embedKey, parseEmbedUrl } from '@/lib/url'
import { fetchTweet, normalizeTweet } from './twitter'
import { fetchNostr, normalizeNostr } from './nostr'

/**
 * data of an embed, every provider normalizes to this shape
 * @typedef {Object} EmbedData
 * @property {string} href - link to the original
 * @property {Object} author - name, handle, href, avatar
 * @property {string} [createdAt] - ISO date
 * @property {Object} [replyTo] - who the post replies to
 * @property {string} [title] - title of a nostr article
 * @property {Object[]} text - plain text and links, in order
 * @property {Object[]} media - pictures, a video has its mp4 url and the picture is the poster
 * @property {Object} [preview] - link preview
 * @property {EmbedData} [quote] - quoted post
 */

const PROVIDERS = {
  twitter: { fetch: fetchTweet, normalize: normalizeTweet },
  nostr: { fetch: fetchNostr, normalize: normalizeNostr }
}

/** provider and id of a tweet or nostr link, null for any other url */
export function fetchableEmbed (url) {
  const embed = parseEmbedUrl(url)
  return PROVIDERS[embed?.provider] ? embed : null
}

// embed data is cached in memory, "not found" too, so we don't ask X or the relays on every view
const embedDataCache = cachedFetcher(async function fetchEmbedData ({ provider, id }) {
  const { fetch, normalize } = PROVIDERS[provider]
  const raw = await fetch(id)
  if (!raw) return null

  // raw data we can't read is not an outage, retrying won't change it, so we show a plain link
  try {
    return normalize(raw)
  } catch (err) {
    console.error('error reading embed:', provider, id, err)
    return null
  }
}, {
  maxSize: 1000,
  cacheExpiry: 60 * 60 * 1000, // 1 hour
  forceRefreshThreshold: 24 * 60 * 60 * 1000, // 1 day
  keyGenerator: embedKey
})

/** the embed data of a tweet or nostr link, null if the post is not found or the url is another kind of link.
 * throws if X or the relays can't be reached
 */
export async function getEmbedData (url) {
  const embed = fetchableEmbed(url)
  if (!embed) return null
  return await embedDataCache(embed)
}
