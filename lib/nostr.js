import { bech32 } from 'bech32'
import { nip19 } from 'nostr-tools'

export const NOSTR_PUBKEY_HEX = /^[0-9a-fA-F]{64}$/
export const NOSTR_PUBKEY_BECH32 = /^npub1[02-9ac-hj-np-z]+$/
export const NOSTR_MAX_RELAY_NUM = 20
export const NOSTR_ZAPPLE_PAY_NPUB = 'npub1wxl6njlcgygduct7jkgzrvyvd9fylj4pqvll6p32h59wyetm5fxqjchcan'
export const DEFAULT_CROSSPOSTING_RELAYS = [
  'wss://nostrue.com/',
  'wss://relay.damus.io/',
  'wss://relay.nostr.band/',
  'wss://relay.snort.social/',
  'wss://nostr21.com/',
  'wss://nostr.mutinywallet.com/',
  'wss://relay.mutinywallet.com/'
]

function timeoutPromise (timeout) {
  return new Promise((resolve, reject) => {
    // if no timeout is specified, never settle
    if (!timeout) return

    setTimeout(reject, timeout)
  })
}

export class Relay {
  constructor (relayUrl) {
    const ws = new window.WebSocket(relayUrl)

    ws.onmessage = function (msg) {
      const [type, notice] = JSON.parse(msg.data)
      if (type === 'NOTICE') {
        console.log('relay notice:', notice)
      }
    }

    ws.onerror = function (err) {
      console.error('websocket error: ' + err)
      this.error = err
    }

    this.ws = ws
  }

  static async connect (url, { timeout } = {}) {
    const relay = new Relay(url)
    await relay.waitUntilConnected({ timeout })
    return relay
  }

  get connected () {
    return this.ws.readyState === window.WebSocket.OPEN
  }

  get closed () {
    return this.ws.readyState === window.WebSocket.CLOSING || this.ws.readyState === window.WebSocket.CLOSED
  }

  async waitUntilConnected ({ timeout } = {}) {
    let interval

    const checkPromise = new Promise((resolve, reject) => {
      interval = setInterval(() => {
        if (this.connected) {
          resolve()
        }
        if (this.closed) {
          reject(new Error(`failed to connect to ${this.url}: ` + this.error))
        }
      }, 100)
    })

    try {
      return await Promise.race([
        timeoutPromise(timeout),
        checkPromise
      ])
    } finally {
      clearInterval(interval)
    }
  }

  close () {
    const state = this.ws.readyState
    if (state !== window.WebSocket.CLOSING && state !== window.WebSocket.CLOSED) {
      this.ws.close()
    }
  }

  async publish (event, { timeout } = {}) {
    const ws = this.ws

    let listener
    const ackPromise = new Promise((resolve, reject) => {
      ws.send(JSON.stringify(['EVENT', event]))

      listener = function onmessage (msg) {
        const [type, eventId, accepted, reason] = JSON.parse(msg.data)

        if (type !== 'OK' || eventId !== event.id) return

        if (accepted) {
          resolve(eventId)
        } else {
          reject(new Error(reason || `event rejected: ${eventId}`))
        }
      }

      ws.addEventListener('message', listener)
    })

    try {
      return await Promise.race([
        timeoutPromise(timeout),
        ackPromise

      ])
    } finally {
      ws.removeEventListener('message', listener)
    }
  }

  async fetch (filter, { timeout } = {}) {
    const ws = this.ws

    let listener
    const ackPromise = new Promise((resolve, reject) => {
      const id = crypto.randomUUID()

      ws.send(JSON.stringify(['REQ', id, ...filter]))

      const events = []
      let eose = false

      listener = function onmessage (msg) {
        const [type, eventId, event] = JSON.parse(msg.data)

        if (eventId !== id) return

        if (type === 'EVENT') {
          events.push(event)
          if (eose) {
            // EOSE was already received:
            // return first event after EOSE
            resolve(events)
          }
          return
        }

        if (type === 'CLOSED') {
          return resolve(events)
        }

        if (type === 'EOSE') {
          eose = true
          if (events.length > 0) {
            // we already received events before EOSE:
            // return all events before EOSE
            ws.send(JSON.stringify(['CLOSE', id]))
            return resolve(events)
          }
        }
      }

      ws.addEventListener('message', listener)
    })

    try {
      return await Promise.race([
        timeoutPromise(timeout),
        ackPromise
      ])
    } finally {
      ws.removeEventListener('message', listener)
    }
  }
}

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
    const timeout = 3000
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
    const signedEvent = await callWithTimeout(() => window.nostr.signEvent(event), 10000)
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

    let noteId = null
    if (signedEvent.kind !== 1) {
      noteId = await nip19.naddrEncode({
        kind: signedEvent.kind,
        pubkey: signedEvent.pubkey,
        identifier: signedEvent.tags[0][1]
      })
    } else {
      noteId = hexToBech32(signedEvent.id, 'note')
    }

    return { successfulRelays, failedRelays, noteId }
  } catch (error) {
    console.error('Crosspost error:', error)
    return { error }
  }
}

export function callWithTimeout (targetFunction, timeoutMs) {
  return new Promise((resolve, reject) => {
    Promise.race([
      targetFunction(),
      new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeouted after ' + timeoutMs + ' ms waiting for extension')), timeoutMs))
    ]).then(resolve)
      .catch(reject)
  })
}
