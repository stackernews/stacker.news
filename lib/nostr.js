import { bech32 } from 'bech32'
import { nip19 } from 'nostr-tools'
import NDK, { NDKEvent, NDKRelaySet, NDKPrivateKeySigner, NDKNip07Signer } from '@nostr-dev-kit/ndk'

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

export const RELAYS_BLACKLIST = []

/**
 * @import {NDKSigner} from '@nostr-dev-kit/ndk'
 * @import { NDK } from '@nostr-dev-kit/ndk'
 * @import {NDKNwc} from '@nostr-dev-kit/ndk'
 * @typedef {Object} Nostr
 * @property {NDK} ndk
 * @property {function(string, {logger: Object}): Promise<NDKNwc>} nwc
 * @property {function(Object, {privKey: string, signer: NDKSigner}): Promise<NDKEvent>} sign
 * @property {function(Object, {relays: Array<string>, privKey: string, signer: NDKSigner}): Promise<NDKEvent>} publish
 */
export class Nostr {
  /**
   * @type {NDK}
   */
  _ndk = null
  _privKey = null
  _relays = []
  constructor ({ privKey, defaultSigner, relays, supportNip07 = true, ...ndkOptions } = {}) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      window.localStorage.debug = 'ndk:*,ndk-wallet:*'
    }
    this._privKey = privKey
    this._relays = relays?.sort()
    this._ndk = new NDK({
      explicitRelayUrls: relays,
      blacklistRelayUrls: RELAYS_BLACKLIST,
      autoConnectUserRelays: false,
      autoFetchUserMutelist: false,
      clientName: 'stacker.news',
      signer: defaultSigner ?? this.selectSigner({ privKey, supportNip07 }),
      ...ndkOptions
    })
  }

  close () {
    // TODO: how?
  }

  checkConfig ({ privKey, relays }) {
    relays = relays?.sort()
    if (this._privKey !== privKey) return false
    if (this._relays?.length !== relays?.length) return false
    if (this._relays?.some((r, i) => r !== relays[i])) return false
    return true
  }

  selectSigner ({ privKey, supportNip07 = true } = {}) {
    return (privKey ? new NDKPrivateKeySigner(privKey) : null) ?? (supportNip07 && typeof window !== 'undefined' && window?.nostr ? new NDKNip07Signer() : null)
  }

  /**
   * @returns {Promise<string>}
   */
  get pubKey () {
    return this._ndk.signer.user().then(u => u.pubkey)
  }

  /**
   * @returns {Promise<Array<string>>}
   */
  get relays () {
    return this._relays
  }

  /**
   * @returns {string|undefined}
   */
  get privKey () {
    return this._privKey
  }

  /**
   * @returns {NDKSigner}
   */
  get signer () {
    return this._ndk.signer
  }

  /**
   * Get a nwc wallet
   * @param {string} nwcUrl
   * @returns {Promise<NDKNwc>}
   */
  async nwc (nwcUrl) {
    return await this._ndk.nwc(nwcUrl)
  }

  get ndk () {
    return this._ndk
  }

  /**
   * Subscribe to events
   * @import {NDKFilter} from '@nostr-dev-kit/ndk'
   * @import {NDKEvent} from '@nostr-dev-kit/ndk'
   * @param {NDKFilter[]|NDKFilter} filters
   * @param {NDKEvent): void} onEvent
   * @param {Object} options
   * @param {Array<string>} options.relays
   * @param {boolean} [options.closeOnEose]
   */
  subscribe (filters, { onEvent, onEose, relays, closeOnEose = false, waitClose = false } = {}) {
    const ndk = this._ndk
    const relaySet = NDKRelaySet.fromRelayUrls(relays, ndk, true)

    const sub = ndk.subscribe(filters, {
      skipOptimisticPublishEvent: true
    }, relaySet)

    if (onEvent) {
      sub.on('event', (event) => {
        const r = onEvent(sub, event)
        if (r instanceof Promise) r.catch(console.error)
      })
    }

    const closingPromise = new Promise((resolve, reject) => {
      sub.on('close', () => {
        resolve()
      })
    })
    sub.wait = async () => closingPromise

    // code is a bit fonky, but it is to make sure
    // sub is closed only after onEose is called
    // and that if onEose is a promise, the exception is caught
    if (onEose || closeOnEose) {
      sub.on('eose', () => {
        let r
        if (onEose) {
          r = onEose(sub)
        }
        if (r instanceof Promise) {
          r.catch(console.error).finally(() => {
            if (closeOnEose) sub.stop()
          })
        } else {
          if (closeOnEose) sub.stop()
        }
      })
    }

    return sub
  }

  /**
   * @param {Object} rawEvent
   * @param {number} rawEvent.kind
   * @param {number} rawEvent.created_at
   * @param {string} rawEvent.content
   * @param {Array<Array<string>>} rawEvent.tags
   * @param {Object} context
   * @param {string} context.privKey
   * @param {NDKSigner} context.signer
   * @returns {Promise<NDKEvent>}
   */
  /* eslint-disable camelcase */
  async sign ({ kind, created_at, content, tags }, { privKey, signer } = {}) {
    const event = new NDKEvent(this._ndk)
    event.kind = kind
    event.created_at = created_at
    event.content = content
    event.tags = tags

    signer = signer ?? (privKey ? new NDKPrivateKeySigner(privKey) : this._ndk.signer)
    if (!signer) throw new Error('no way to sign this event, please provide a signer or private key')
    await event.sign(signer)
    return event
  }

  /**
   * @param {Object} rawEvent
   * @param {number} rawEvent.kind
   * @param {number} rawEvent.created_at
   * @param {string} rawEvent.content
   * @param {Array<Array<string>>} rawEvent.tags
   * @param {Object} context
   * @param {Array<string>} context.relays
   * @param {string} context.privKey
   * @param {NDKSigner} context.signer
   * @param {number} context.timeout
   * @returns {Promise<NDKEvent>}
   */
  /* eslint-disable camelcase */
  async publish ({ created_at, content, tags = [], kind }, { relays, privKey, signer, timeout } = {}) {
    const event = await this.sign({ kind, created_at, content, tags }, { privKey, signer })

    const successfulRelays = []
    const failedRelays = []

    const relaySet = NDKRelaySet.fromRelayUrls(relays, this._ndk, true)

    event.on('relay:publish:failed', (relay, error) => {
      failedRelays.push({ relay: relay.url, error })
    })

    for (const relay of (await relaySet.publish(event, timeout))) {
      successfulRelays.push(relay.url)
    }

    return {
      event,
      successfulRelays,
      failedRelays
    }
  }

  /* eslint-disable camelcase */
  async crosspost ({ created_at, content, tags = [], kind }, { relays = DEFAULT_CROSSPOSTING_RELAYS, privKey, signer, timeout } = {}) {
    try {
      const { event: signedEvent, successfulRelays, failedRelays } = await this.publish({ created_at, content, tags, kind }, { relays, privKey, signer, timeout })

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
}

/**
 * @type {Nostr}
 */
export default new Nostr()

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
