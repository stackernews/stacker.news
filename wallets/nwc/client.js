import { parseNwcUrl } from '@/lib/url'
import { Relay, finalizeEvent, nip04 } from 'nostr-tools'

export * from 'wallets/nwc'

export async function testConnectClient ({ nwcUrl }, { logger }) {
  const { relayUrl, walletPubkey } = parseNwcUrl(nwcUrl)

  logger.info(`requesting info event from ${relayUrl}`)
  const relay = await Relay
    .connect(relayUrl)
    .catch(() => {
      // NOTE: passed error is undefined for some reason
      const msg = `failed to connect to ${relayUrl}`
      logger.error(msg)
      throw new Error(msg)
    })
  logger.ok(`connected to ${relayUrl}`)

  try {
    await new Promise((resolve, reject) => {
      let found = false
      const sub = relay.subscribe([
        {
          kinds: [13194],
          authors: [walletPubkey]
        }
      ], {
        onevent (event) {
          found = true
          logger.ok(`received info event from ${relayUrl}`)
          resolve(event)
        },
        onclose (reason) {
          if (!['closed by caller', 'relay connection closed by us'].includes(reason)) {
            // only log if not closed by us (caller)
            const msg = 'connection closed: ' + (reason || 'unknown reason')
            logger.error(msg)
            reject(new Error(msg))
          }
        },
        oneose () {
          if (!found) {
            const msg = 'EOSE received without info event'
            logger.error(msg)
            reject(new Error(msg))
          }
          sub?.close()
        }
      })
    })
  } finally {
    // For some reason, this throws 'WebSocket is already in CLOSING or CLOSED state'
    // even though relay connection is still open here
    relay?.close()?.catch()
    if (relay) logger.info(`closed connection to ${relayUrl}`)
  }
}

export async function sendPayment (bolt11, { nwcUrl }, { logger }) {
  const { relayUrl, walletPubkey, secret } = parseNwcUrl(nwcUrl)

  const relay = await Relay.connect(relayUrl).catch(() => {
    // NOTE: passed error is undefined for some reason
    throw new Error(`failed to connect to ${relayUrl}`)
  })
  logger.ok(`connected to ${relayUrl}`)

  try {
    const ret = await new Promise(function (resolve, reject) {
      (async function () {
        const payload = {
          method: 'pay_invoice',
          params: { invoice: bolt11 }
        }
        const content = await nip04.encrypt(secret, walletPubkey, JSON.stringify(payload))

        const request = finalizeEvent({
          kind: 23194,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['p', walletPubkey]],
          content
        }, secret)
        await relay.publish(request)

        const filter = {
          kinds: [23195],
          authors: [walletPubkey],
          '#e': [request.id]
        }
        relay.subscribe([filter], {
          async onevent (response) {
            try {
              const content = JSON.parse(await nip04.decrypt(secret, walletPubkey, response.content))
              if (content.error) return reject(new Error(content.error.message))
              if (content.result) return resolve({ preimage: content.result.preimage })
            } catch (err) {
              return reject(err)
            }
          },
          onclose (reason) {
            if (!['closed by caller', 'relay connection closed by us'].includes(reason)) {
              // only log if not closed by us (caller)
              const msg = 'connection closed: ' + (reason || 'unknown reason')
              reject(new Error(msg))
            }
          }
        })
      })().catch(reject)
    })
    return ret
  } finally {
    // For some reason, this throws 'WebSocket is already in CLOSING or CLOSED state'
    // even though relay connection is still open here
    relay?.close()?.catch()
    if (relay) logger.info(`closed connection to ${relayUrl}`)
  }
}
