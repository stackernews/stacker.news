import { Relay } from '@/lib/nostr'
import { parseNwcUrl } from '@/lib/url'
import { nwcSchema } from '@/lib/validate'
import { finalizeEvent, nip04, verifyEvent } from 'nostr-tools'

export const name = 'nwc'

export const fields = [
  {
    name: 'nwcUrl',
    label: 'connection',
    type: 'password',
    optional: 'for sending',
    clientOnly: true,
    editable: false
  },
  {
    name: 'nwcUrlRecv',
    label: 'connection',
    type: 'password',
    optional: 'for receiving',
    serverOnly: true,
    editable: false
  }
]

export const card = {
  title: 'NWC',
  subtitle: 'use Nostr Wallet Connect for payments',
  badges: ['send & receive', 'budgetable']
}

export const fieldValidation = nwcSchema

export const walletType = 'NWC'

export const walletField = 'walletNWC'

export async function nwcCall ({ nwcUrl, method, params }, { logger, timeout } = {}) {
  const { relayUrl, walletPubkey, secret } = parseNwcUrl(nwcUrl)

  const relay = await Relay.connect(relayUrl, { timeout })
  logger?.ok(`connected to ${relayUrl}`)

  try {
    const payload = { method, params }
    const encrypted = await nip04.encrypt(secret, walletPubkey, JSON.stringify(payload))

    const request = finalizeEvent({
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', walletPubkey]],
      content: encrypted
    }, secret)

    // we need to subscribe to the response before publishing the request
    // since NWC events are ephemeral (20000 <= kind < 30000)
    const subscription = relay.fetch([{
      kinds: [23195],
      authors: [walletPubkey],
      '#e': [request.id]
    }], { timeout })

    await relay.publish(request, { timeout })

    logger?.info(`published ${method} request`)

    logger?.info('waiting for response ...')

    const [response] = await subscription

    if (!response) {
      throw new Error('no response')
    }

    logger?.ok('response received')

    if (!verifyEvent(response)) throw new Error('invalid response: failed to verify')

    const decrypted = await nip04.decrypt(secret, walletPubkey, response.content)
    const content = JSON.parse(decrypted)

    if (content.error) throw new Error(content.error.message)
    if (content.result) return content.result

    throw new Error('invalid response: missing error or result')
  } finally {
    relay?.close()
    logger?.info(`closed connection to ${relayUrl}`)
  }
}

export async function supportedMethods (nwcUrl, { logger, timeout } = {}) {
  const result = await nwcCall({ nwcUrl, method: 'get_info' }, { logger, timeout })
  return result.methods
}
