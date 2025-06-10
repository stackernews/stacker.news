// worker/nostrCrosspost.js
// Background worker to process delayed Nostr crossposts
import Nostr from '@/lib/nostr'
import { msatsToSats } from '@/lib/format'

const RELAYS = [
  'wss://nos.lol/',
  'wss://nostr.land/',
  'wss://nostr.wine/',
  'wss://purplerelay.com/',
  'wss://relay.damus.io/',
  'wss://relay.snort.social/',
  'wss://relay.nostr.band/',
  'wss://relay.primal.net/'
]

export async function nostrCrosspost({ boss, models, nostrLib = Nostr }) {
  // Find all items ready to be crossposted
  const now = new Date()
  const items = await models.item.findMany({
    where: {
      pendingNostrCrosspost: true,
      nostrCrosspostAt: { lte: now }
    }
  })

  for (const item of items) {
    try {
      // Compose the Nostr message
      const message = `${item.title || ''}\n${item.text || ''}\nhttps://stacker.news/items/${item.id}`.trim()
      const nostr = nostrLib.get()
      const signer = nostr.getSigner({ privKey: process.env.NOSTR_PRIVATE_KEY })
      await nostr.publish({
        created_at: Math.floor(Date.now() / 1000),
        content: message,
        tags: [],
        kind: 1
      }, {
        relays: RELAYS,
        signer,
        timeout: 5000
      })
      // Mark as crossposted
      await models.item.update({
        where: { id: item.id },
        data: { pendingNostrCrosspost: false }
      })
      console.log(`Crossposted item ${item.id} to Nostr`)
    } catch (err) {
      console.error(`Failed to crosspost item ${item.id} to Nostr`, err)
    }
  }
}
