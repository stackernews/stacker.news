import { parseEmbedUrl, findUrls } from '@/lib/url'
import jsdom from 'jsdom'
import { youtubeClipSchema, youtubeClipMetaSchema, validateSchema } from '@/lib/validate'

const YoutubeClipsMetaFetcher = async function (embed) {
  await validateSchema(youtubeClipSchema, embed)

  let { meta } = embed
  const { clipId } = meta
  const fullUrl = `https://www.youtube.com/clip/${clipId}`
  const html = await fetch(fullUrl).then(res => res.text())
  const dom = new jsdom.JSDOM(html)
  const metaProp = dom.window.document.querySelector('meta[property="og:video:url"]')

  if (metaProp) {
    const content = metaProp.getAttribute('content')
    const clipId = content.match(/clip=([^&]+)/)[1]
    const videoId = content.match(/embed\/([^?]+)/)[1]
    const clipt = content.match(/clipt=([^&]+)/)[1]
    meta = {
      clipId,
      clipt,
      videoId
    }
    await validateSchema(youtubeClipMetaSchema, meta)
    return meta
  }

  return {}
}

const MetaFetchers = {
  'youtube-clip': YoutubeClipsMetaFetcher
}

export async function fetchEmbedMeta ({ data: { id }, models }) {
  console.log('[fetchEmbedMeta] fetching embed meta for item', id)
  const item = await models.item.findUnique({ where: { id } })

  const text = item.text
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
    if (!fetcher) continue

    // we'll wait the promises all at once to allow for parallel fetching
    embedMetaPromises.push(fetcher(embed).then(meta => ({ provider, embedId, meta })))
  }

  const [fetchResults, errors] = (await Promise.allSettled(embedMetaPromises)).reduce((acc, p) => {
    if (p.status === 'fulfilled') acc[0].push(p.value)
    else acc[1].push(p.reason)
    return acc
  }, [[], []])

  if (errors.length) {
    console.warn('[fetchEmbedMeta] error', errors)
  }

  if (fetchResults.length) {
    console.log('[fetchEmbedMeta] upserting', fetchResults.length, 'embeds for item', id)
    await models.$transaction(async (tx) => {
      await Promise.all(fetchResults.map(({ provider, embedId, meta }) => {
        return tx.embedMeta.upsert({
          where: { id_provider: { id: embedId, provider } },
          create: { id: embedId, provider, meta },
          update: { meta }
        })
      }))
      await tx.itemEmbedMeta.deleteMany({ where: { itemId: id } })
      await tx.itemEmbedMeta.createMany({
        data: fetchResults.map(({ provider, embedId }) => ({ itemId: id, embedId, provider }))
      })
    })
  }
}
