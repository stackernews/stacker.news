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

// the saved embed data of each item, as { 'provider:id': data }, see embedKey
export function createItemEmbedsLoader (models) {
  return new DataLoader(async (itemIds) => {
    const links = await models.itemEmbed.findMany({
      where: { itemId: { in: [...itemIds] } },
      select: { itemId: true, embed: { select: { provider: true, providerId: true, data: true } } }
    })
    const embeds = new Map(itemIds.map(id => [id, {}]))
    for (const { itemId, embed: { provider, providerId, data } } of links) {
      embeds.get(itemId)[embedKey({ provider, id: providerId })] = data
    }
    return itemIds.map(id => embeds.get(id))
  })
}
