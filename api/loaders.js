import DataLoader from 'dataloader'

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
