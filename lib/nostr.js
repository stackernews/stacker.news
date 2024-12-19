import { bech32 } from 'bech32'
import { nip19 } from 'nostr-tools'
import NDK, { NDKEvent, NDKNip46Signer, NDKRelaySet, NDKPrivateKeySigner, NDKNip07Signer } from '@nostr-dev-kit/ndk'

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

/* eslint-disable camelcase */

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
export default class Nostr {
  /**
   * @type {NDK}
   */
  _ndk = null
  static globalInstance = null
  constructor ({ privKey, defaultSigner, relays, nip46token, supportNip07 = false, ...ndkOptions } = {}) {
    this._ndk = new NDK({
      explicitRelayUrls: relays,
      blacklistRelayUrls: RELAYS_BLACKLIST,
      autoConnectUserRelays: false,
      autoFetchUserMutelist: false,
      clientName: 'stacker.news',
      signer: defaultSigner ?? this.getSigner({ privKey, supportNip07, nip46token }),
      ...ndkOptions
    })
  }

  /**
   * @type {NDK}
   */
  static get () {
    if (!Nostr.globalInstance) {
      Nostr.globalInstance = new Nostr()
    }
    return Nostr.globalInstance
  }

  /**
   * @type {NDK}
   */
  get ndk () {
    return this._ndk
  }

  /**
   *
   * @param {Object} param0
   * @param {string} [args.privKey] - private key to use for signing
   * @param {string} [args.nip46token] - NIP-46 token to use for signing
   * @param {boolean} [args.supportNip07] - whether to use NIP-07 signer if available
   * @returns {NDKPrivateKeySigner | NDKNip46Signer | NDKNip07Signer | null} - a signer instance
   */
  getSigner ({ privKey, nip46token, supportNip07 = true } = {}) {
    if (privKey) return new NDKPrivateKeySigner(privKey)
    if (nip46token) return new NDKNip46SignerURLPatch(this.ndk, nip46token)
    if (supportNip07 && typeof window !== 'undefined' && window?.nostr) return new NDKNip07Signer()
    return null
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
  async sign ({ kind, created_at, content, tags }, { signer } = {}) {
    const event = new NDKEvent(this.ndk, {
      kind,
      created_at,
      content,
      tags
    })
    signer ??= this.ndk.signer
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
  async publish ({ created_at, content, tags = [], kind }, { relays, signer, timeout } = {}) {
    const event = await this.sign({ kind, created_at, content, tags }, { signer })

    const successfulRelays = []
    const failedRelays = []

    const relaySet = NDKRelaySet.fromRelayUrls(relays, this.ndk, true)

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

  async crosspost ({ created_at, content, tags = [], kind }, { relays = DEFAULT_CROSSPOSTING_RELAYS, signer, timeout } = {}) {
    try {
      signer ??= this.getSigner({ supportNip07: true })
      const { event: signedEvent, successfulRelays, failedRelays } = await this.publish({ created_at, content, tags, kind }, { relays, signer, timeout })

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

  /**
   * Close all relay connections
   */
  close () {
    const pool = this.ndk.pool
    for (const relay of pool.urls()) {
      pool.removeRelay(relay)
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

// workaround NDK url parsing issue (see https://github.com/stackernews/stacker.news/pull/1636)
class NDKNip46SignerURLPatch extends NDKNip46Signer {
  connectionTokenInit (connectionToken) {
    connectionToken = connectionToken.replace('bunker://', 'http://')
    return super.connectionTokenInit(connectionToken)
  }
}
