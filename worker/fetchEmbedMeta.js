import { parseEmbedUrl, findUniqueUrls } from '@/lib/url'
import { getEmbedMetaFetcher } from '@/lib/embedFetcher'

export async function fetchEmbedMeta ({ data: { id: itemId }, models }) {
  console.log('[fetchEmbedMeta] fetching embed meta for item', itemId)
  const item = await models.item.findUnique({ where: { id: itemId } })

  const text = item.text || item.url
  if (!text) return

  const urls = findUniqueUrls(text) // extract every url from the text
  if (!urls.length) return

  const embeds = urls
    .map(url => parseEmbedUrl(url)) // parse every unique url as a potential embed (initial url based deduplication)
    .filter(embed => !!embed) // if it is not an embed, we can skip it
    .reduce((acc, embed) => { // deduplicate embeds by id and provider (they might have different urls but be resolved to the same embed)
      if (!acc.some(e => e.provider === embed.provider && e.id === embed.id)) {
        acc.push(embed)
      }
      return acc
    }, [])

  const embedMetaPromises = []
  for (const embed of embeds) {
    const { provider, id } = embed

    // we get a fetcher for this provider, if it doesn't have one, it means it doesn't need
    // any additional metadata, so we can skip it
    const fetcher = getEmbedMetaFetcher(embed)
    if (!fetcher) continue

    // if the embed doesn't have an id, we can't fetch it because
    // we don't have a way to reliably identify it in the database,
    // this is most likely a bug in the lib/url/parseEmbedUrl parser,
    // so we skip it and print a warning
    if (!id) {
      console.warn('[fetchEmbedMeta] embed', provider, "doesn't have an id, skipping")
      continue
    }

    const existingMeta = await models.embedMeta.findUnique({ where: { provider, id } })
    if (existingMeta) {
      // we reuse existing meta to avoid fetching it again
      // N.B. it is important to try to reinsert the existing metadata, because
      //      the embedMeta entry might have been orphaned and subsequently deleted (by the cleanup trigger)
      //      between the time this check is performed and the embedMeta entry is linked to the item.
      //      The alternative would be to run everything into a transaction, but that would be less efficient.
      embedMetaPromises.push(Promise.resolve({ provider, id, meta: existingMeta.meta }))
    } else {
      // we'll wait the promises all at once to allow for parallel fetching
      embedMetaPromises.push(fetcher(embed).then(newMeta => ({ ...embed, meta: newMeta })))
    }
  }

  // separate success from errors
  const [fetchResults, errors] = (await Promise.allSettled(embedMetaPromises)).reduce((acc, p) => {
    if (p.status === 'fulfilled') acc[0].push(p.value)
    else acc[1].push(p.reason)
    return acc
  }, [[], []])

  // log errors
  if (errors.length) {
    console.warn('[fetchEmbedMeta] error', errors)
  }

  // store the results
  if (fetchResults.length) {
    console.log('[fetchEmbedMeta] updating', fetchResults.length, 'embeds for item', itemId)
    await models.$transaction(async (tx) => {
      await tx.embedMeta.createMany({
        data: fetchResults.map(({ provider, id, meta }) => ({ id, provider, meta })),
        skipDuplicates: true
      })

      await tx.itemEmbedMeta.deleteMany({
        where: {
          itemId,
          NOT: {
            OR: fetchResults.map(({ provider, id: embedId }) => ({ provider, embedId }))
          }
        }
      })

      await tx.itemEmbedMeta.createMany({
        data: fetchResults.map(({ provider, id: embedId }) => ({ itemId, embedId, provider })),
        skipDuplicates: true
      })
    })
  }
}
