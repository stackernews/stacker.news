import { extractUrls } from '@/lib/md'
import { fetchableEmbed, getEmbedData } from '@/lib/embeds'
import { embedKey } from '@/lib/url'

// saves the embed data of the tweets and nostr links in an item,
// so the item can show them without fetching from X or relays
export async function embeds ({ data: { id }, models }) {
  const item = await models.item.findUnique({ where: { id } })

  const urls = extractUrls(item.text)
  // the link of a link post is drawn as an embed below the text
  if (item.url) urls.push(item.url)

  // a link written twice is fetched once
  const links = new Map()
  for (const url of urls) {
    const embed = fetchableEmbed(url)
    if (embed) links.set(embedKey(embed), { url, provider: embed.provider, providerId: embed.id })
  }

  // no links to fetch
  if (links.size === 0) {
    // delete existing data if any
    await models.itemEmbed.deleteMany({ where: { itemId: id } })
    return
  }

  // a link that is not found or fails keeps the data it had.
  // the links are fetched at the same time, because nostr lookups only share relay connections while they overlap
  const failed = []
  await Promise.all([...links].map(async ([key, { url, provider, providerId }]) => {
    try {
      const data = await getEmbedData(url)
      if (data) {
        await models.embed.upsert({
          where: { provider_providerId: { provider, providerId } },
          create: { provider, providerId, data },
          update: { data }
        })
      }
    } catch (err) {
      console.error('error fetching embed:', key, err)
      failed.push(key)
    }
  }))

  // link the item to the saved data of each link, whether it was saved now or earlier
  const saved = await models.embed.findMany({
    where: { OR: [...links.values()].map(({ provider, providerId }) => ({ provider, providerId })) },
    select: { id: true }
  })
  await models.$transaction([
    models.itemEmbed.deleteMany({ where: { itemId: id } }),
    models.itemEmbed.createMany({ data: saved.map(embed => ({ itemId: id, embedId: embed.id })) })
  ])

  // the data we got is saved, now throw so the job retries the failed links
  if (failed.length > 0) throw new Error(`embeds not fetched: ${failed.join(', ')}`)
}
