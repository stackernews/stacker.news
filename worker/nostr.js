import { getInvoice } from 'ln-service'
import { signId, calculateId, getPublicKey } from 'nostr'
import { Relay } from '@/lib/nostr'

const nostrOptions = { startAfter: 5, retryLimit: 21, retryBackoff: true }

export async function nip57 ({ data: { hash }, boss, lnd, models }) {
  let inv, lnInv
  try {
    lnInv = await getInvoice({ id: hash, lnd })
    inv = await models.invoice.findUnique({
      where: {
        hash
      }
    })
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
    tags.push(['bolt11', lnInv.request])
    tags.push(['description', inv.desc])
    tags.push(['preimage', lnInv.secret])

    const e = {
      kind: 9735,
      pubkey: getPublicKey(process.env.NOSTR_PRIVATE_KEY),
      created_at: Math.floor(new Date(lnInv.confirmed_at).getTime() / 1000),
      content: '',
      tags
    }
    e.id = await calculateId(e)
    e.sig = await signId(process.env.NOSTR_PRIVATE_KEY, e.id)

    console.log('zap note', e, relays)
    await Promise.allSettled(
      relays.map(r => (async function () {
        const timeout = 1000
        const relay = await Relay.connect(r, { timeout })
        await relay.publish(e, { timeout })
      })())
    )
  } catch (e) {
    console.log(e)
  }
}
