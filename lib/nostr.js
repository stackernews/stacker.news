import { bech32 } from 'bech32'
import { nip19 } from 'nostr-tools'
import WebSocket from 'isomorphic-ws'
import { callWithTimeout, withTimeout } from '@/lib/time'
import crypto from 'crypto'

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

export class Relay {
  constructor (relayUrl) {
    const ws = new WebSocket(relayUrl)

    ws.onmessage = function (msg) {
      const [type, notice] = JSON.parse(msg.data)
      if (type === 'NOTICE') {
        console.log('relay notice:', notice)
      }
    }

    ws.onerror = function (err) {
      console.error('websocket error:', err.message)
      this.error = err.message
    }

    this.ws = ws
    this.url = relayUrl
    this.error = null
  }

  static async connect (url, { timeout } = {}) {
    const relay = new Relay(url)
    await relay.waitUntilConnected({ timeout })
    return relay
  }

  get connected () {
    return this.ws.readyState === WebSocket.OPEN
  }

  get closed () {
    return this.ws.readyState === WebSocket.CLOSING || this.ws.readyState === WebSocket.CLOSED
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
      return await withTimeout(checkPromise, timeout)
    } catch (err) {
      this.close()
      throw err
    } finally {
      clearInterval(interval)
    }
  }

  close () {
    const state = this.ws.readyState
    if (state !== WebSocket.CLOSING && state !== WebSocket.CLOSED) {
      this.ws.close()
    }
  }

  async publish (event, { timeout } = {}) {
    const ws = this.ws

    let listener
    const ackPromise = new Promise((resolve, reject) => {
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

      ws.send(JSON.stringify(['EVENT', event]))
    })

    try {
      return await withTimeout(ackPromise, timeout)
    } finally {
      ws.removeEventListener('message', listener)
    }
  }

  async fetch (filter, { timeout } = {}) {
    const ws = this.ws

    let listener
    const ackPromise = new Promise((resolve, reject) => {
      const id = crypto.randomBytes(16).toString('hex')

      const events = []
      let eose = false

      listener = function onmessage (msg) {
        const [type, subId, event] = JSON.parse(msg.data)

        if (subId !== id) return

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

      ws.send(JSON.stringify(['REQ', id, ...filter]))
    })

    try {
      return await withTimeout(ackPromise, timeout)
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

async function publishNostrEvent (signedEvent, relayUrl) {
  const timeout = 3000
  const relay = await Relay.connect(relayUrl, { timeout })
  try {
    await relay.publish(signedEvent, { timeout })
  } finally {
    relay.close()
  }
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
