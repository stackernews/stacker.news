import { bech32 } from 'bech32'

import WebSocket from 'isomorphic-ws'
import { callWithTimeout, withTimeout } from '@/lib/time'
import { nip04, nip19, finalizeEvent, verifyEvent, SimplePool, getPublicKey, generateSecretKey } from 'nostr-tools'
import { parseBunkerInput } from 'nostr-tools/nip46'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

import { v4 as uuidv4 } from 'uuid'
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
export const DEFAULT_NIP46_RELAYS = [
  'wss://relay.damus.io/',
  'wss://relay.snort.social/'
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
      return await withTimeout(ackPromise, timeout)
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
  await relay.publish(signedEvent, { timeout })
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

export class NostrSigner {
  constructor (
    signableKinds = [22242],
    meta = {},
    appRelayUrls = DEFAULT_NIP46_RELAYS
  ) {
    this.appRelayUrls = appRelayUrls
    this.appPrivKey = generateSecretKey()
    this.appPubKey = getPublicKey(this.appPrivKey)
    this.appRelayPool = undefined
    this.appSubs = []

    this.userRelayPool = undefined
    this.userSubs = []
    this.meta = meta
    this.signableKinds = signableKinds

    this.bunker = {
      relays: [],
      pubkey: undefined,
      secret: undefined
    }
    this.nip46Auth = false
    this.listeners = {}
    this.idCount = 0
    this.initRemoteId = this.getNewRandomId() + '.r'
    this.pool = new SimplePool()
    this.syncQueue = Promise.resolve()
  }

  /**
   * Enqueue functions to be executed synchronously
   * @param {*} fn the function to enqueue
   */
  enqueue (fn) {
    this.syncQueue = this.syncQueue.then(async () => {
      try {
        await fn()
      } catch (e) {
        console.error(e)
      }
    })
  }

  /**
   * Get a new unique random request id
   * @returns {string} - Returns a new unique random request id
   */
  getNewRandomId () {
    return 'sn' + uuidv4() + this.idCount++
  }

  async startWithConfig (config, challengeHandler = undefined) {
    this.appPrivKey = hexToBytes(config.appPrivKey)
    this.appRelayUrls = config.appRelayUrls
    this.bunker = config.bunker
    if (this.bunker.pubkey && this.bunker.relays.length > 0) {
      await this.connectApp(this.bunker, challengeHandler, false)
    }
  }

  /**
   * Return the configuration of the NostrSigner instance that can be used to recreate it
   * @returns {Object} - Returns the current configuration of the NostrSigner instance
   */
  getConfigSnapshot () {
    return {
      appPrivKey: bytesToHex(this.appPrivKey),
      appRelayUrls: this.appRelayUrls,
      bunker: this.bunker
    }
  }

  /**
   * Get the NostrConnect URL for the current instance used to initiate a connection with the app
   * @returns {string} Returns the NostrConnect URL
   */
  getNostrConnectUrl () {
    let url = `nostrconnect://${this.appPubKey}?metadata=${encodeURIComponent(JSON.stringify(this.meta))}`
    // cose a random relay from the app relays (can nostrconnect have more than one relay param?)
    const relay = this.appRelayUrls[Math.floor(Math.random() * this.appRelayUrls.length)]
    url += `&relay=${encodeURIComponent(relay)}`
    return url
  }

  /**
   * Disconnect the app
   */
  disconnectApp () {
    this.userSubs.forEach(sub => sub.close())
    this.userSubs = []
    for (const id in this.listeners) {
      this.listeners[id].reject(new Error('connection closed'))
    }
    this.listeners = {}
    // reset auth state
    this.nip46Auth = false
    // close connection to relays that are used only for the app connection
    this.pool.close(this.bunker.relays.filter(r => !this.appRelayUrls.includes(r)))
  }

  /**
   * Stop listening for spontaneous connections
   */
  stopListeningForSpontaneousConnections () {
    this.appSubs.forEach(sub => sub.close())
    this.appSubs = []
    const listener = this.listeners[this.initRemoteId]
    if (listener) {
      listener.reject(new Error('connection closed'))
      delete this.listeners[this.initRemoteId]
    }
    // close connection to relays that are used only for the spontaneous connection listener
    this.pool.close(this.appRelayUrls.filter(r => !this.bunker.relays.includes(r)))
  }

  /**
   * Close all
   */
  close () {
    // stop listener
    this.stopListeningForSpontaneousConnections()
    // disconnect app
    this.disconnectApp()
  }

  /**
   * Event handler, decrypts and processes incoming events and calls the appropriate listener
   * @param {*} event the nostr event
   */
  async _onEvent (event) {
    event.content = await nip04.decrypt(this.appPrivKey, event.pubkey, event.content)
    event.content = JSON.parse(event.content)

    const id = event.content.id
    const error = event.content.error
    const result = event.content.result
    if (!id) throw new Error('invalid event content')
    const listener = this.listeners[id]

    if (!listener) return // we are not listening for this event

    if (result === 'auth_url') {
      if (!listener.authChallengeReceived) {
        if (!listener.challengeHandler) {
          throw new Error('auth url received but no way to handle it')
        }
        await listener.challengeHandler(error, result)
        listener.authChallengeReceived = true
      }
      // we don't remove the listener, because we are going to receive
      // another ack event after the auth challenge is completed
      return
    }

    if (error) {
      listener.reject(new Error(error))
    } else {
      listener.resolve(event)
    }
    delete this.listeners[event.content.id]
  }

  async _onIncomingConnection (event, challengeHandler) {
    if (this.nip46Auth) return // already connected
    const userPubKey = event.content.params[0] || event.pubkey
    const requestId = event.content.id
    const ackEvent = {
      kind: 24133,
      created_at: Math.floor(Date.now() / 1000),
      content: JSON.stringify({
        id: requestId,
        result: 'ack'
      }),
      tags: [['p', userPubKey]]
    }
    ackEvent.content = await nip04.encrypt(this.appPrivKey, userPubKey, ackEvent.content)
    const signedAckEvent = finalizeEvent(ackEvent, this.appPrivKey)
    if (!verifyEvent(signedAckEvent)) throw new Error('invalid event')
    await Promise.allSettled(this.pool.publish(this.appRelayUrls, signedAckEvent))
    if (this.nip46Auth) return // check if we connected in another way in the meantime
    // we reconstruct the bunker data from the ack event
    this.bunker = {}
    this.bunker.pubkey = event.content.params[0] || event.pubkey
    this.bunker.secret = '' // we don't have a secret in this case
    this.bunker.relays = [...this.appRelayUrls] // the app relay
    for (const tag of event.tags) { // if the signer suggested relays, we use them too
      if (tag[0] === 'relays') {
        this.bunker.relays.push(...tag[1])
      } else if (tag[0] === 'relay') {
        this.bunker.relays.push(tag[1])
      }
    }
    // and connect to the app
    return await this.connectApp(this.bunker, challengeHandler, false) // nb. no need to send a connection request in this case
  }

  /**
   * Wait for a response to a request
   * @param {string} id - The id of the request
   * @param {string} method - The method of the request
   * @param {function} challengeHandler - The handler for auth challenges
   * @returns {Promise} - Returns a promise that resolves in a *decrypted* and *parsed* event
   */
  async waitForResponse (id, method, challengeHandler) {
    return new Promise((resolve, reject) => {
      this.listeners[id] = {
        method,
        reject,
        resolve,
        authChallengeReceived: false,
        challengeHandler
      }
    })
  }

  /**
   * Listen for incoming events that might signal a spontaneous connection (ie. initiated from the signer)
   * @param {*} challengeHandler - The handler for auth challenges
   * @param {*} onConnection - A callback that is called when a connection is established
   */
  async startListeningForSpontaneousConnections (challengeHandler, onConnection) {
    try {
      if (this.appSubs.length > 0) return // already listening
      this.appSubs.push(this.pool.subscribeMany(this.appRelayUrls, [
        {
          // listen for any event for this app
          kinds: [24133],
          since: Math.floor(Date.now() / 1000) - 60,
          '#p': [this.appPubKey]
        }
      ],
      {
        onevent: async (event) => {
          try {
            // ensure the relays is not cheating
            if (!verifyEvent(event)) throw new Error('invalid event')
            // process the event
            event.content = await nip04.decrypt(this.appPrivKey, event.pubkey, event.content)
            event.content = JSON.parse(event.content)
            const method = event.content.method
            // handle incoming connections
            if (method === 'connect') {
              // ensure connections are processed synchronously
              this.enqueue(async () => {
                const res = await this._onIncomingConnection(event, challengeHandler)
                if (onConnection && res) onConnection()
              })
            }
          } catch (e) {
            // malformed event
            console.error(e)
          }
        }
      }))
    } catch (e) {
      console.error(e)
    }
  }

  /**
   * Connect to the specified bunker info and close the spontaneous connection listener
   * @param {*} input the bunker url or object
   * @param {*} challengeHandler  the handler for auth challenges
   * @param {*} sendConnectionRequest  whether to send a connection request to the app
   */
  async connectApp (input, challengeHandler, sendConnectionRequest = true) {
    try {
      if (!input) throw new Error('invalid input')
      this.disconnectApp() // disconnect if already connected
      // parse bunker input
      if (typeof input === 'string') {
        this.bunker = await parseBunkerInput(input)
      } else {
        this.bunker = input
      }

      if (!this.bunker || !this.bunker.pubkey || !this.bunker.relays || this.bunker.relays.length === 0) {
        throw new Error('invalid bunker data')
      }

      // start a pool to subscribe to all the relays provided in the bunker data
      this.userRelayPool = new SimplePool()
      this.userSubs.push(this.pool.subscribeMany(this.bunker.relays, [
        {
          kinds: [24133],
          since: Math.floor(Date.now() / 1000) - 60,
          authors: [this.bunker.pubkey], // we know the signer pubkey, so we listen only to its events
          '#p': [this.appPubKey]
        }
      ],
      {
        onevent: async (event) => {
          try {
            // ensure the relays is not cheating
            if (event.pubkey !== this.bunker.pubkey) throw new Error('invalid event')
            if (!verifyEvent(event)) throw new Error('invalid event')
            // process the event
            await this._onEvent(event)
          } catch (e) {
            console.error(e)
            // malformed event
          }
        }
      }
      ))
      // if we are initiating the connection, we need to send a connection request
      if (sendConnectionRequest) {
        const permissions = this.signableKinds.map(k => 'sign_event:' + k)
        const resp = await this.sendRPC('connect', [this.bunker.pubkey, this.bunker.secret, permissions.join(',')], challengeHandler)
        if (resp !== 'ack') {
          throw new Error('connection failed')
        }
      }
      // we are connected
      this.nip46Auth = true
      return true
    } catch (e) {
      console.error(e)
      this.disconnectApp()
      return false
    }
  }

  /**
   * Sign an event with the remote signer or a browser extension
   * @param {*} event the event to sign
   * @param {*} preferExt whether to prefer the browser extension
   * @returns signed event
   */
  async signEvent (event, preferExt = false, challengeHandler) {
    if (window.nostr && (!this.nip46Auth || preferExt)) {
      const signedEvent = await callWithTimeout(() => window.nostr.signEvent(event), 5000)
      if (!signedEvent) throw new Error('failed to sign event')
    } else if (this.nip46Auth) {
      const signedEvent = await this.sendRPC('sign_event', [
        JSON.stringify({
          kind: event.kind,
          content: event.content,
          tags: event.tags,
          created_at: event.created_at
        })
      ], challengeHandler)
      return JSON.parse(signedEvent)
    } else {
      throw new Error('no nostr signer found')
    }
  }

  async sendRPC (method, params, challengeHandler) {
    if (!this.bunker || !this.bunker.pubkey || !this.bunker.relays || this.bunker.relays.length === 0) {
      throw new Error('please connect to a signer first')
    }
    return callWithTimeout(async () => {
      const requestId = this.getNewRandomId()
      const userPubKey = this.bunker.pubkey
      const signEvent = {
        kind: 24133,
        created_at: Math.floor(Date.now() / 1000),
        content: JSON.stringify({
          id: requestId,
          method,
          params
        }),
        tags: [['p', userPubKey]]
      }
      signEvent.content = await nip04.encrypt(this.appPrivKey, userPubKey, signEvent.content)
      const signedEvent = finalizeEvent(signEvent, this.appPrivKey)
      if (!verifyEvent(signedEvent)) throw new Error('invalid event')
      await Promise.all(this.pool.publish(this.bunker.relays, signedEvent))
      const resp = await this.waitForResponse(requestId, method, challengeHandler)
      return resp.content.result
    }, 60000)
  }
}
