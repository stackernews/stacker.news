import { Relay } from '@/lib/nostr'
import { parseNwcUrl } from '@/lib/url'
import { finalizeEvent, nip04 } from 'nostr-tools'

export * from 'wallets/nwc'

export async function testConnectServer ({ nwcUrlRecv }) {
  return await createInvoice({ msats: 1000, expiry: 1 }, { nwcUrlRecv })
}

export async function createInvoice (
  { msats, description, expiry },
  { nwcUrlRecv }) {
  const { relayUrl, walletPubkey, secret } = parseNwcUrl(nwcUrlRecv)

  const relay = await Relay.connect(relayUrl)

  try {
    const payload = {
      method: 'make_invoice',
      params: { amount: msats, description, expiry }
    }
    const encrypted = await nip04.encrypt(secret, walletPubkey, JSON.stringify(payload))

    const request = finalizeEvent({
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', walletPubkey]],
      content: encrypted
    }, secret)
    await relay.publish(request)

    const [response] = await relay.fetch([{
      kinds: [23195],
      authors: [walletPubkey],
      '#e': [request.id]
    }])

    if (!response) {
      throw new Error('no response')
    }

    const decrypted = await nip04.decrypt(secret, walletPubkey, response.content)
    const content = JSON.parse(decrypted)

    if (content.error) throw new Error(content.error.message)
    if (content.result) return content.result.invoice

    throw new Error('invalid response')
  } finally {
    relay?.close()
  }
}
