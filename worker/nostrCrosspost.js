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
      // Fetch the user to get their Nostr pubkey (and privkey if available)
      const user = await models.user.findUnique({ where: { id: item.userId } })
      if (!user || !user.nostrPubkey) {
        console.error(`User for item ${item.id} does not have a linked Nostr pubkey, skipping crosspost.`)
        continue
      }
      // Use the user's Nostr pubkey for signing if supported by the Nostr library
      // (Assume the backend has a way to sign with the pubkey, e.g., via NIP-46 or extension delegation)
      // If not, fallback to SN's key or skip
      const nostr = nostrLib.get()
      let signer
      try {
        signer = nostr.getSigner({ pubkey: user.nostrPubkey })
      } catch (e) {
        console.error(`No signing method available for user ${user.id} (pubkey: ${user.nostrPubkey}), skipping crosspost.`)
        continue
      }
      // Compose the Nostr message
      const message = `${item.title || ''}\n${item.text || ''}\nhttps://stacker.news/items/${item.id}`.trim()
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
      console.log(`Crossposted item ${item.id} to Nostr as user ${user.id}`)
    } catch (err) {
      console.error(`Failed to crosspost item ${item.id} to Nostr`, err)
    }
  }
}
