import { parseEmbedUrl, findUrls } from '@/lib/url'
import jsdom from 'jsdom'
import { youtubeClipSchema, youtubeClipMetaSchema, validateSchema } from '@/lib/validate'

/**
 * @typedef {Object} YoutubeClipMeta
 * @property {string} clipId - the clip id
 * @property {string} videoId - the video id
 * @property {string} clipt - the clipt
 */

/**
 * Fetches metadata for youtube clips
 * @param {Object} embed
 * @param {Object} embed.meta - the incomplete embed metadata
 * @param {string} embed.meta.clipId - the clip id
 * @returns {Promise<YoutubeClipMeta>} - the fetched metadata
 */
const YoutubeClipsMetaFetcher = async function (embed) {
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
    console.warn('[fetchEmbedMeta] clipId mismatch for', fullUrl, ':', fClipId, '!=', clipId)
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

const MetaFetchers = {
  'youtube-clip': YoutubeClipsMetaFetcher
}

export async function fetchEmbedMeta ({ data: { id }, models }) {
  console.log('[fetchEmbedMeta] fetching embed meta for item', id)
  const item = await models.item.findUnique({ where: { id } })

  const text = item.text || item.url

  if (!text) return

  const urls = findUrls(text) // extract every url from the text
  if (!urls.length) return

  const embedMetaPromises = []

  for (const url of urls) { // parse every url as a potential embed
    const embed = parseEmbedUrl(url)
    if (!embed) continue

    const { provider, id: embedId } = embed
    if (!embedId) continue // can't fetch meta for embeds without an id

    const fetcher = MetaFetchers[provider]
    if (!fetcher) continue // there is no additional fetch logic for this provider

    const existingMeta = await models.embedMeta.findUnique({ where: { provider, id: embedId } })
    if (existingMeta) {
      // we reuse existing meta to avoid fetching it again
      // N.B. it is important to try to reinsert the existing metadata, because
      //      the embedMeta entry might have been orphaned and subsequently deleted (by the cleanup trigger)
      //      between the time this check is performed and the embedMeta entry is linked to the item.
      //      The alternative would be to run everything into a transaction, but that would be less efficient.
      embedMetaPromises.push(Promise.resolve({ provider, embedId, meta: existingMeta.meta }))
    } else {
      // we'll wait the promises all at once to allow for parallel fetching
      embedMetaPromises.push(fetcher(embed).then(meta => ({ provider, embedId, meta })))
    }
  }

  // separate success from errors
  const [fetchResults, errors] = (await Promise.allSettled(embedMetaPromises)).reduce((acc, p) => {
    if (p.status === 'fulfilled') acc[0].push(p.value)
    else acc[1].push(p.reason)
    return acc
  }, [[], []])

  if (errors.length) {
    console.warn('[fetchEmbedMeta] error', errors)
  }

  if (fetchResults.length) {
    console.log('[fetchEmbedMeta] updating', fetchResults.length, 'embeds for item', id)
    await models.$transaction(async (tx) => {
      await tx.embedMeta.createMany({
        data: fetchResults.map(({ provider, embedId, meta }) => ({ id: embedId, provider, meta })),
        skipDuplicates: true
      })

      await tx.itemEmbedMeta.deleteMany({
        where: {
          itemId: id,
          NOT: {
            OR: fetchResults.map(({ provider, embedId }) => ({ provider, embedId }))
          }
        }
      })

      await tx.itemEmbedMeta.createMany({
        data: fetchResults.map(({ provider, embedId }) => ({ itemId: id, embedId, provider })),
        skipDuplicates: true
      })
    })
  }
}
