import DataLoader from 'dataloader'
import { embedKey } from '@/lib/url'

export function createUserLoader (models) {
  return new DataLoader(async (ids) => {
    const users = await models.user.findMany({ where: { id: { in: [...ids] } } })
    const userMap = new Map(users.map(u => [u.id, u]))
    return ids.map(id => userMap.get(id) || null)
  })
}

export function createSubLoader (models) {
  return new DataLoader(async (names) => {
    const subs = await models.sub.findMany({ where: { name: { in: [...names] } } })
    const subMap = new Map(subs.map(s => [s.name, s]))
    return names.map(name => subMap.get(name) || null)
  })
}

export function createItemEmbedsLoader (models) {
  return new DataLoader(async (itemIds) => {
    const itemEmbeds = await models.itemEmbed.findMany({
      where: { itemId: { in: [...itemIds] } },
      select: {
        itemId: true,
        embed: {
          select: { provider: true, providerId: true, data: true }
        }
      }
    })

    // items without embeds still resolve to {}
    const embedsByItem = new Map(itemIds.map(id => [id, {}]))

    // {'provider:id': data }
    for (const { itemId, embed } of itemEmbeds) {
      const key = embedKey({ provider: embed.provider, id: embed.providerId })
      const embeds = embedsByItem.get(itemId)
      embeds[key] = embed.data
    }

    return itemIds.map(id => embedsByItem.get(id))
  })
}
