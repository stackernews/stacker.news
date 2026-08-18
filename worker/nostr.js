import Nostr from '@/lib/nostr'
import { createHash } from 'crypto'
import { parsePaymentRequest } from 'ln-service'

export async function nip57 ({ data: { hash }, boss, lnd, models }) {
  const payInBolt11 = await models.payInBolt11.findUnique({
    where: {
      hash,
      confirmedAt: { not: null },
      preimage: { not: null },
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

  const externalTransaction = payInBolt11
    ? null
    : await models.externalTransaction.findFirst({
      where: {
        hash,
        direction: 'RECEIVE',
        outcome: 'SETTLED',
        preimage: { not: null }
      },
      include: { nostrNote: true }
    })
  const directNostrNote = externalTransaction?.nostrNote

  // check if invoice still exists since JIT invoices get deleted after usage
  if (!payInBolt11 && !directNostrNote) return

  const nostrNote = payInBolt11?.nostrNote ?? directNostrNote
  const { note, rawRequest } = nostrNote
  const bolt11 = payInBolt11 ? payInBolt11.bolt11 : externalTransaction.bolt11
  const preimage = payInBolt11 ? payInBolt11.preimage : externalTransaction.preimage
  const confirmedAt = payInBolt11
    ? payInBolt11.confirmedAt
    : externalTransaction.settledAt ?? externalTransaction.updatedAt

  try {
    if (!preimage) throw new Error('cannot publish NIP-57 receipt without a preimage')
    if (typeof rawRequest !== 'string') throw new Error('cannot publish NIP-57 receipt without its raw request')

    const invoice = parsePaymentRequest({ request: bolt11 })
    const requestHash = createHash('sha256').update(rawRequest).digest('hex')
    if (invoice.description_hash?.toLowerCase() !== requestHash) {
      throw new Error('NIP-57 request does not match the invoice description hash')
    }

    const recipientTag = note.tags.filter(t => t?.length >= 2 && t[0] === 'p')[0]
    const eventTag = note.tags.filter(t => t?.length >= 2 && t[0] === 'e')[0]
    const addressTag = note.tags.filter(t => t?.length >= 2 && t[0] === 'a')[0]
    const senderTag = typeof note.pubkey === 'string' ? ['P', note.pubkey] : null
    const kindTag = note.tags.filter(t => t?.length >= 2 && t[0] === 'k')[0]
    const relays = note.tags.find(t => t?.length >= 2 && t[0] === 'relays').slice(1)

    const tags = [recipientTag]
    if (eventTag) tags.push(eventTag)
    if (addressTag) tags.push(addressTag)
    if (senderTag) tags.push(senderTag)
    if (kindTag) tags.push(kindTag)
    tags.push(['bolt11', bolt11])
    tags.push(['description', rawRequest])
    tags.push(['preimage', preimage])

    const e = {
      kind: 9735,
      created_at: Math.floor(new Date(confirmedAt).getTime() / 1000),
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
    console.error('failed to publish NIP-57 receipt:', e)
  }
}
