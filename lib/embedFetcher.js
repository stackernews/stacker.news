import { youtubeClipSchema, youtubeClipMetaSchema, validateSchema } from '@/lib/validate'
import jsdom from 'jsdom'

/**
 * @typedef {Object} Embed
 * @property {string} id - the embed id
 * @property {Object} meta - the (incomplete) embed metadata
 * @property {string} provider - the embed provider
 */

/**
 * @template T
 * @typedef {function(Embed): Promise<T>} MetaFetcher
 * @param {Embed} embed
 * @returns {Promise<T>} - the fetched metadata
 */

/**
 * @typedef {Object} YoutubeClipMeta
 * @property {string} clipId - the clip id
 * @property {string} videoId - the video id
 * @property {string} clipt - the clipt
 */

/**
 * Fetches metadata for youtube clips
 * @type {MetaFetcher<YoutubeClipMeta>}
 */
export async function YoutubeClipsMetaFetcher (embed) {
  await validateSchema(youtubeClipSchema, embed)
  const { meta: { clipId } } = embed

  const fullUrl = `https://www.youtube.com/clip/${clipId}`
  const html = await fetch(fullUrl).then(res => res.text())
  const dom = new jsdom.JSDOM(html)
  const metaProp = dom.window.document.querySelector('meta[property="og:video:url"]')

  if (!metaProp) throw new Error('missing meta property og:video:url')

  const content = metaProp.getAttribute('content')

  const fClipId = content.match(/clip=([^&]+)/)[1]
  if (fClipId !== clipId) {
    // should never happen unless the youtube api changes
    console.warn('[YoutubeClipsMetaFetcher] clipId mismatch for', fullUrl, ':', fClipId, '!=', clipId)
  }

  const videoId = content.match(/embed\/([^?]+)/)[1]
  const clipt = content.match(/clipt=([^&]+)/)[1]

  const meta = {
    clipId: fClipId,
    clipt,
    videoId
  }

  await validateSchema(youtubeClipMetaSchema, meta)
  return meta
}

/**
 * All the available fetchers
 * @type {Object.<string, MetaFetcher<Object>>}
 */
export const MetaFetchers = {
  'youtube-clip': YoutubeClipsMetaFetcher
}

/**
 * Returns the most appropriate fetcher for an embed
 * @param {Embed} embed - the embed to get the fetcher for
 * @param {Object.<string, MetaFetcher<Object>>} [fetchers] - a key-value object of fetchers (default to all available fetchers)
 * @returns {MetaFetcher<Object>|undefined} - the fetcher for the embed or undefined if none is found
 */
export function getEmbedMetaFetcher (embed, fetchers = MetaFetchers) {
  const { provider } = embed
  return fetchers[provider]
}
