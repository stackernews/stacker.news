import { bech32 } from 'bech32'

export const NOSTR_PUBKEY_HEX = /^[0-9a-fA-F]{64}$/
export const NOSTR_PUBKEY_BECH32 = /^npub1[02-9ac-hj-np-z]+$/
export const NOSTR_MAX_RELAY_NUM = 20
export const NOSTR_ZAPPLE_PAY_NPUB = 'npub1wxl6njlcgygduct7jkgzrvyvd9fylj4pqvll6p32h59wyetm5fxqjchcan'
export const DEFAULT_CROSSPOSTING_RELAYS = [
  'wss://nostrue.com/',
  'wss://relay.damus.io/',
  'wss://relay.nostr.band/',
  'wss://relay.snort.social/',
  'wss://nostr21.com/'
]

export function hexToBech32 (hex, prefix = 'npub') {
  return bech32.encode(prefix, bech32.toWords(Buffer.from(hex, 'hex')))
}

export function nostrZapDetails (zap) {
  let { pubkey, content, tags } = zap
  let npub = hexToBech32(pubkey)
  if (npub === NOSTR_ZAPPLE_PAY_NPUB) {
    const znpub = content.match(/^From: nostr:(npub1[02-9ac-hj-np-z]+)$/)?.[1]
    if (znpub) {
      npub = znpub
      // zapple pay does not support user content
      content = null
    }
  }
  const event = tags.filter(t => t?.length >= 2 && t[0] === 'e')?.[0]?.[1]
  const note = event ? hexToBech32(event, 'note') : null

  return { npub, content, note }
}

async function publishNostrEvent (signedEvent, relay) {
  return new Promise((resolve, reject) => {
    const timeout = 1000
    const wsRelay = new window.WebSocket(relay)
    let timer
    let isMessageSentSuccessfully = false

    function timedout () {
      clearTimeout(timer)
      wsRelay.close()
      reject(new Error(`relay timeout for ${relay}`))
    }

    timer = setTimeout(timedout, timeout)

    wsRelay.onopen = function () {
      clearTimeout(timer)
      timer = setTimeout(timedout, timeout)
      wsRelay.send(JSON.stringify(['EVENT', signedEvent]))
    }

    wsRelay.onmessage = function (msg) {
      const m = JSON.parse(msg.data)
      if (m[0] === 'OK') {
        isMessageSentSuccessfully = true
        clearTimeout(timer)
        wsRelay.close()
        console.log('Successfully sent event to', relay)
        resolve()
      }
    }

    wsRelay.onerror = function (error) {
      clearTimeout(timer)
      console.log(error)
      reject(new Error(`relay error: Failed to send to ${relay}`))
    }

    wsRelay.onclose = function () {
      clearTimeout(timer)
      if (!isMessageSentSuccessfully) {
        reject(new Error(`relay error: Failed to send to ${relay}`))
      }
    }
  })
}

export async function crosspost (event, relays = DEFAULT_CROSSPOSTING_RELAYS) {
  try {
    const signedEvent = await window.nostr.signEvent(event)
    if (!signedEvent) throw new Error('failed to sign event')

    const promises = relays.map(r => publishNostrEvent(signedEvent, r))
    const results = await Promise.allSettled(promises)
    const successfulRelays = []
    const failedRelays = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulRelays.push(relays[index])
      } else {
        failedRelays.push({ relay: relays[index], error: result.reason })
      }
    })

    const eventId = hexToBech32(signedEvent.id, 'nevent')

    return { successfulRelays, failedRelays, eventId }
  } catch (error) {
    console.error('Crosspost discussion error:', error)
    return { error }
  }
}
