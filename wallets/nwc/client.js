import { parseNwcUrl } from '@/lib/url'
import { finalizeEvent, nip04 } from 'nostr-tools'
import { Relay } from '@/lib/nostr'

export * from 'wallets/nwc'

export async function testConnectClient ({ nwcUrl }, { logger }) {
  const { relayUrl, walletPubkey } = parseNwcUrl(nwcUrl)

  logger.info(`requesting info event from ${relayUrl}`)

  const relay = await Relay.connect(relayUrl)
  logger.ok(`connected to ${relayUrl}`)

  try {
    const [info] = await relay.fetch([{
      kinds: [13194],
      authors: [walletPubkey]
    }])

    if (info) {
      logger.ok(`received info event from ${relayUrl}`)
    } else {
      throw new Error('info event not found')
    }
  } finally {
    relay?.close()
    logger.info(`closed connection to ${relayUrl}`)
  }
}

export async function sendPayment (bolt11, { nwcUrl }, { logger }) {
  const { relayUrl, walletPubkey, secret } = parseNwcUrl(nwcUrl)

  const relay = await Relay.connect(relayUrl)
  logger.ok(`connected to ${relayUrl}`)

  try {
    const payload = {
      method: 'pay_invoice',
      params: { invoice: bolt11 }
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
    if (content.result) return { preimage: content.result.preimage }

    throw new Error('invalid response')
  } finally {
    // For some reason, this throws 'WebSocket is already in CLOSING or CLOSED state'
    // even though relay connection is still open here
    relay?.close()?.catch()
    if (relay) logger.info(`closed connection to ${relayUrl}`)
  }
}
