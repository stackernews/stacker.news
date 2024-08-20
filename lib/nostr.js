import { bech32 } from 'bech32'

import WebSocket from 'isomorphic-ws'
import { callWithTimeout, withTimeout } from '@/lib/time'
import { nip04, nip19, finalizeEvent, verifyEvent, getPublicKey, generateSecretKey } from 'nostr-tools'
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
  constructor (relayUrl, reconnectOnClose = false) {
    this.url = relayUrl
    this.subs = []
    this.reconnectOnClose = reconnectOnClose
    this._closed = false
    this.error = undefined
    this.reconnect()
  }

  reconnect () {
    this._closed = false
    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.onmessage = (msg) => {
      const [type, notice] = JSON.parse(msg.data)
      if (type === 'NOTICE') {
        console.log('relay notice:', notice)
      }
    }

    ws.onerror = (err) => {
      console.error('websocket error: ' + err)
      this.error = err
    }

    ws.onclose = () => {
      if (this.reconnectOnClose && !this._closed) {
        setTimeout(() => {
          if (!this._closed) {
            this.reconnect()
          }
        }, 5000)
      }
    }

    ws.onopen = () => {
      // Resubscribe to all subscriptions on reconnect
      for (const sub of this.subs) {
        ws.send(JSON.stringify(['REQ', sub.id, ...sub.filters]))
      }
    }
  }

  static async connect (url, { timeout } = {}) {
    const relay = new Relay(url)
    await relay.waitUntilConnected({ timeout })
    return relay
  }

  get connected () {
    return this.ws.readyState === WebSocket.OPEN && !this._closed
  }

  get closed () {
    return this.ws.readyState === WebSocket.CLOSING || this.ws.readyState === WebSocket.CLOSED || this._closed
  }

  set closed (value) {
    this._closed = value
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
    this._closed = true
    if (state !== WebSocket.CLOSING && state !== WebSocket.CLOSED) {
      this.ws.close()
    }
    for (const sub of this.subs) {
      if (sub.closed) continue
      sub.reject(new Error('relay closed'))
    }
    this.subs = []
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

  subscribe (filters, handler, keepAlive = true) {
    const ws = this.ws

    const listener = (msg) => {
      try {
        const [type, id, event] = JSON.parse(msg.data)
        switch (type) {
          case 'EVENT': {
            const subId = id
            const sub = this.subs.find(s => s.id === subId)
            if (!sub) return
            sub.events.push(event)
            if (sub.handler) sub.handler(event)
            if (sub.closing) sub.close()
            break
          }
          case 'CLOSED': {
            if (keepAlive) {
              const sub = this.subs.find(s => s.id === id)
              if (!sub) return
              sub.close(true)
            }
            break
          }
          case 'EOSE': {
            const subId = id
            const sub = this.subs.find(s => s.id === subId)
            if (!sub) return
            if (!keepAlive) {
              if (sub.events.length > 0) {
                // we already received events before EOSE:
                // return all events before EOSE and close the subscription immediately
                sub.close()
              } else {
                // if no events were received, we mark the subscription for closing
                // and wait for the next event
                sub.closing = true
              }
            }
            break
          }
        }
      } catch (e) {
        console.error('failed to process message:', e)
      }
    }

    const sub = {
      id: crypto.randomUUID(),
      ws,
      filters,
      handler,
      keepAlive,
      closing: false,
      events: [],
      listener,
      resolve: () => {},
      reject: () => {},
      promise: Promise.resolve(),
      closed: false,
      wait: async (timeout) => {
        try {
          return await withTimeout(sub.promise, timeout)
        } finally {
          sub.close()
        }
      },
      close: (remotely) => {
        if (this.closed) return
        if (!remotely) {
          try {
            sub.ws.send(JSON.stringify(['CLOSE', sub.id]))
          } catch (e) {
            console.error('failed to send CLOSE:', e)
          }
        }
        try {
          sub.ws.removeEventListener('message', sub.listener)
        } catch (e) {
          console.error('failed to remove listener:', e)
        }
        this.subs = this.subs.filter(s => s.id !== sub.id)
        sub.closed = true
        sub.resolve(sub.events)
      }
    }
    this.subs.push(sub)

    sub.promise = new Promise((resolve, reject) => {
      try {
        sub.resolve = resolve
        sub.reject = reject
        ws.addEventListener('message', sub.listener)
        ws.send(JSON.stringify(['REQ', sub.id, ...sub.filters]))
      } catch (e) {
        reject(e)
      }
    }).catch((e) => {
      console.error('failed to subscribe:', e)
      sub.close()
    })
    return sub
  }

  async fetch (filter, { timeout } = {}) {
    const sub = await this.subscribe(filter, () => {}, false)
    return await sub.wait(timeout)
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
    this.signableKinds = signableKinds
    this.meta = meta
    this.appRelayUrls = appRelayUrls

    this.appPrivKey = generateSecretKey()
    this.appPubKey = getPublicKey(this.appPrivKey)

    this.appSubs = []
    this.userSubs = []

    this.bunker = {
      relays: [],
      pubkey: undefined,
      secret: undefined
    }

    this.nip46Auth = false
    this.listeners = {}
    this.idCount = 0
    this.pool = []
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

  async subscribeMany (relays, filters, handler) {
    const newConnections = await Promise.allSettled(relays.filter(r => !this.pool.find(p => p.url === r)).map(r => Relay.connect(r)))
    const subs = []
    for (const conn of newConnections) {
      if (conn.status === 'fulfilled') {
        const connectedRelay = conn.value
        const sub = connectedRelay.subscribe(filters, handler)
        subs.push(sub)
        this.pool.push(connectedRelay)
      } else {
        console.error('failed to connect to relay:', conn.reason)
      }
    }
    return subs
  }

  async startWithConfig (config, challengeHandler = undefined) {
    this.appPrivKey = hexToBytes(config.appPrivKey)
    this.appRelayUrls = config.appRelayUrls
    this.bunker = config.bunker
    if (this.bunker.pubkey && this.bunker.relays.length > 0) {
      await this.connect(this.bunker, challengeHandler, false)
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
    // select up to 3 relays (prevent qr code from being too dense)
    // in random order (workaround limitation of some clients that read only the first relay param)
    const relays = this.appRelayUrls.sort(() => Math.random() - 0.5).slice(0, 3)
    for (const relay of relays) {
      url += `&relay=${encodeURIComponent(relay)}`
    }
    return url
  }

  closeRelays (urls) {
    for (let i = 0; i < this.pool.length; i++) {
      if (urls.includes(this.pool[i].url)) {
        this.pool[i].close()
        this.pool.splice(i, 1)
        i--
      }
    }
  }

  /**
   * Disconnect the app
   */
  disconnect () {
    this.userSubs.forEach(sub => sub.close())
    this.userSubs = []
    for (const l of Object.values(this.listeners)) {
      l.reject(new Error('connection closed'))
    }
    this.listeners = {}
    // reset auth state
    this.nip46Auth = false
    // close connection to relays that are used only for the app connection
    if (this.bunker && this.bunker.relays) {
      const relays = this.bunker.relays.filter(r => !this.appRelayUrls.includes(r))
      this.closeRelays(relays)
    }
  }

  /**
   * Stop listening for spontaneous connections
   */
  stopListeningForSpontaneousConnections () {
    this.appSubs.forEach(sub => sub.close())
    this.appSubs = []
    // close connection to relays that are used only for the spontaneous connection listener
    const relays = this.bunker && this.bunker.relays ? this.pool.filter(r => !this.bunker.relays.includes(r.url)) : this.appRelayUrls
    this.closeRelays(relays)
  }

  /**
   * Close all
   */
  close () {
    // stop listener
    this.stopListeningForSpontaneousConnections()
    // disconnect app
    this.disconnect()
    // disconnect from all relays
    for (const relay of this.pool) {
      relay.close()
    }
    this.pool = []
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

    if (listener.eventTracker.includes(event.id)) return // we already processed this event
    listener.eventTracker.push(event.id)

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
    await Promise.allSettled(this.pool.map(p => p.publish(signedAckEvent)))
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
    try {
      await this.connect(this.bunker, challengeHandler, false) // nb. no need to send a connection request in this case
      return true
    } catch (e) {
      console.error(e)
      return false
    }
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
        challengeHandler,
        eventTracker: []
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
      this.appSubs.push(...await this.subscribeMany(this.appRelayUrls, [{
        // listen for any event for this app
        kinds: [24133],
        since: Math.floor(Date.now() / 1000) - 120,
        '#p': [this.appPubKey]
      }],
      async (event) => {
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
      ))
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
  async connect (input, challengeHandler, sendConnectionRequest = true) {
    try {
      if (!input) throw new Error('invalid connection token')
      this.disconnect() // disconnect if already connected
      // parse bunker input
      if (typeof input === 'string') {
        try {
          this.bunker = await parseBunkerInput(input)
        } catch (e) {
          this.bunker = {}
        }
      } else {
        this.bunker = input
      }

      if (!this.bunker || !this.bunker.pubkey || !this.bunker.relays || this.bunker.relays.length === 0) {
        throw new Error('invalid connection token')
      }

      // start a pool to subscribe to all the relays provided in the bunker data
      this.userSubs.push(...await this.subscribeMany(this.bunker.relays, [{
        kinds: [24133],
        since: Math.floor(Date.now() / 1000) - 120,
        authors: [this.bunker.pubkey], // we know the signer pubkey, so we listen only to its events
        '#p': [this.appPubKey]
      }],
      async (event) => {
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
    } catch (e) {
      console.error(e)
      this.nip46Auth = false
      this.disconnect()
      throw e
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
      return signedEvent
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
      let resp = this.waitForResponse(requestId, method, challengeHandler)
      await Promise.allSettled(this.pool.map(p => p.publish(signedEvent)))
      resp = await resp
      return resp.content.result
    }, 60000)
  }
}
