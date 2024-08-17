import { parseNwcUrl } from '@/lib/url'
import { Relay } from '@/lib/nostr'

import { nwcCall } from 'wallets/nwc'
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
  const result = await nwcCall({
    nwcUrl,
    method: 'pay_invoice',
    params: { invoice: bolt11 }
  },
  { logger })
  return result.preimage
}
