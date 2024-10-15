import models from '@/api/models'

export default async function Nip05 ({ query: { name } }, res) {
  const names = {}
  let relays = {}

  const users = await models.user.findMany({
    where: {
      name,
      nostrPubkey: { not: null }
    },
    include: { nostrRelays: true }
  })

  for (const user of users) {
    names[user.name] = user.nostrPubkey
    if (user.nostrRelays.length) {
      // append relays with key pubkey
      relays[user.nostrPubkey] = []
      for (const relay of user.nostrRelays) {
        relays[user.nostrPubkey].push(relay.nostrRelayAddr)
      }
    }
  }

  relays = Object.keys(relays).length ? relays : undefined
  return res.status(200).json({ names, relays })
}
