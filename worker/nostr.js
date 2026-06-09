import Nostr from '@/lib/nostr'
import { parsePaymentRequest } from 'ln-service'

export async function nip57 ({ data: { hash }, boss, lnd, models }) {
  const payInBolt11 = await models.payInBolt11.findUnique({
    where: {
      hash,
      confirmedAt: { not: null },
      nostrNote: { isNot: null },
      payIn: {
        payInType: 'PROXY_PAYMENT',
        payInState: 'PAID'
      }
    },
    include: {
      nostrNote: true
    }
  })

  // check if invoice still exists since JIT invoices get deleted after usage
  if (!payInBolt11) return

  const note = payInBolt11.nostrNote.note

  try {
    const ptag = note.tags.filter(t => t?.length >= 2 && t[0] === 'p')[0]
    const etag = note.tags.filter(t => t?.length >= 2 && t[0] === 'e')[0]
    const atag = note.tags.filter(t => t?.length >= 2 && t[0] === 'a')[0]
    const relays = note.tags.find(t => t?.length >= 2 && t[0] === 'relays').slice(1)

    const tags = [ptag]
    if (etag) tags.push(etag)
    if (atag) tags.push(atag)
    tags.push(['bolt11', payInBolt11.bolt11])
    tags.push(['description', parsePaymentRequest({ request: payInBolt11.bolt11 }).description])
    tags.push(['preimage', payInBolt11.preimage])

    const e = {
      kind: 9735,
      created_at: Math.floor(new Date(payInBolt11.confirmedAt).getTime() / 1000),
      content: '',
      tags
    }

    const nostr = Nostr.get()
    const signer = nostr.getSigner({ privKey: process.env.NOSTR_PRIVATE_KEY })
    await nostr.publish(e, {
      relays,
      signer,
      timeout: 1000
    })
  } catch (e) {
    console.log(e)
  }
}
