import Nostr from '@/lib/nostr'

const nostrOptions = { startAfter: 5, retryLimit: 21, retryBackoff: true }

export async function nip57 ({ data: { hash }, boss, lnd, models }) {
  let inv
  try {
    inv = await models.invoice.findUnique({
      where: {
        hash
      }
    })
    if (!inv || !inv.confirmedAt) return
  } catch (err) {
    console.log(err)
    // on lnd related errors, we manually retry which so we don't exponentially backoff
    await boss.send('nip57', { hash }, nostrOptions)
    return
  }

  // check if invoice still exists since JIT invoices get deleted after usage
  if (!inv) return

  try {
    // if parsing fails it's not a zap
    console.log('zapping', inv.desc)
    const desc = JSON.parse(inv.desc)
    const ptag = desc.tags.filter(t => t?.length >= 2 && t[0] === 'p')[0]
    const etag = desc.tags.filter(t => t?.length >= 2 && t[0] === 'e')[0]
    const atag = desc.tags.filter(t => t?.length >= 2 && t[0] === 'a')[0]
    const relays = desc.tags.find(t => t?.length >= 2 && t[0] === 'relays').slice(1)

    const tags = [ptag]
    if (etag) tags.push(etag)
    if (atag) tags.push(atag)
    tags.push(['bolt11', inv.bolt11])
    tags.push(['description', inv.desc])
    tags.push(['preimage', inv.preimage])

    const e = {
      kind: 9735,
      created_at: Math.floor(new Date(inv.confirmedAt).getTime() / 1000),
      content: '',
      tags
    }

    console.log('zap note', e, relays)
    await Nostr.publish(e, {
      relays,
      privKey: process.env.NOSTR_PRIVATE_KEY,
      timeout: 1000
    })
  } catch (e) {
    console.log(e)
  }
}
