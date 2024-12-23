import { bech32 } from 'bech32'
import { nip19 } from 'nostr-tools'
import NDK, { NDKUser, NDKEvent, NDKNostrRpc, NDKNip46Signer, NDKRelaySet, NDKPrivateKeySigner, NDKNip07Signer } from '@nostr-dev-kit/ndk'
import { withTimeout } from './time'

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
  static _globalInstance = null

  constructor ({ relays, ...ndkOptions } = {}) {
    this._ndk = new NDK({
      explicitRelayUrls: relays,
      blacklistRelayUrls: RELAYS_BLACKLIST,
      autoConnectUserRelays: false,
      autoFetchUserMutelist: false,
      clientName: 'stacker.news',
      ...ndkOptions
    })
  }

  /**
   * @type {NDK}
   */
  static get () {
    if (!Nostr._globalInstance) {
      Nostr._globalInstance = new Nostr()
    }
    return Nostr._globalInstance
  }

  /**
   * @type {NDK}
   */
  get ndk () {
    return this._ndk
  }

  /**
   *
   * @param {Object} args
   * @param {string} [args.userPreferences] - user given preferences
   * @param {string} [args.userPreferences.signerType] - signer type to use for signing (nip07, nip46)
   * @param {string} [args.userPreferences.signer] - signer config to use for signing
   * @param {string} [args.privKey] - private key to use for signing
   * @param {string} [args.nip46token] - NIP-46 token to use for signing
   * @param {boolean} [args.nip07] - whether to use NIP-07 signer if available
   * @returns {NDKPrivateKeySigner | NDKNip46Signer | NDKNip07Signer | null} - a signer instance
   */
  getSigner ({ userPreferences: { signerType: userSignerTypePreference, signer: userSignerPreference, signerInstanceKey } = {}, privKey, nip46token, nip07, nip46LocalSigner } = {}) {
    switch (userSignerTypePreference) {
      case 'nip07':
        nip07 = true
        break
      case 'nip46':
        nip46token = userSignerPreference
        if (signerInstanceKey) nip46LocalSigner = new NDKPrivateKeySigner(signerInstanceKey)
        break
      default:
        console.warn('Unknown user preferences:', userSignerTypePreference, userSignerPreference)
    }
    if (privKey) return new NDKPrivateKeySigner(privKey)
    if (nip46token) return new NDKNip46SignerURLPatch(this.ndk, nip46token, nip46LocalSigner)
    if (nip07 && typeof window !== 'undefined' && window?.nostr) return new NDKNip07Signer()
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
      // If no signer is provided, we default to NIP-07, since that's the saner default for crossposting.
      // We can't default the whole ndk instance to nip-07, since that would cause the extension popup to show up randomly
      signer ??= this.getSigner({ nip07: true })
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

  async blockUntilReady () {
    if (this.nip05 && !this.userPubkey) {
      const user = await NDKUser.fromNip05(this.nip05, this.ndk)
      if (user) {
        this._user = user
        this.userPubkey = user.pubkey
        this.relayUrls = user.nip46Urls
        this.rpc = new NDKNostrRpc(this.ndk, this.localSigner, this.debug, this.relayUrls)
      }
    }
    if (!this.bunkerPubkey && this.userPubkey) {
      this.bunkerPubkey = this.userPubkey
    } else if (!this.bunkerPubkey) {
      throw new Error('Bunker pubkey not set')
    }
    await this.startListening()
    this.rpc.on('authUrl', (...props) => {
      this.emit('authUrl', ...props)
    })
    return new Promise((resolve, reject) => {
      const connectParams = [this.userPubkey ?? '']
      if (this.secret) connectParams.push(this.secret)
      if (!this.bunkerPubkey) throw new Error('Bunker pubkey not set')

      const confirm = async (resolve) => {
        return withTimeout(this.getPublicKey().then((pubkey) => {
          this._user = new NDKUser({ pubkey })
          resolve(this._user)
        }), 15_000)
      }

      // initiate a new connection
      const connector = setTimeout(() => {
        this.rpc.sendRequest(
          this.bunkerPubkey,
          'connect',
          connectParams,
          24133,
          async (response) => {
            try {
              if (response.result === 'ack') {
                await confirm(resolve)
              } else {
                throw new Error(response.error)
              }
            } catch (e) {
              reject(e)
            }
          }
        )
      }, 2100)

      // try to restore the connection
      // if it succeeds, clear the timeout.
      //    One of the two will fail, either the new connection or the restore attempt.
      confirm(resolve)
        .then(() => clearTimeout(connector))
        .catch((err) => console.error('Error restoring connection:', err))
    })
  }
}
