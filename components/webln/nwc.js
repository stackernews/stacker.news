// https://github.com/getAlby/js-sdk/blob/master/src/webln/NostrWeblnProvider.ts

import { Relay, nip04 } from 'nostr-tools'

function parseWalletConnectUrl (walletConnectUrl) {
  walletConnectUrl = walletConnectUrl
    .replace('nostrwalletconnect://', 'http://')
    .replace('nostr+walletconnect://', 'http://') // makes it possible to parse with URL in the different environments (browser/node/...)
  const url = new URL(walletConnectUrl)
  const options = {}
  options.walletPubkey = url.host
  const secret = url.searchParams.get('secret')
  const relayUrl = url.searchParams.get('relay')
  if (secret) {
    options.secret = secret
  }
  if (relayUrl) {
    options.relayUrl = relayUrl
  }
  return options
}

export default {
  storageKey: 'webln:provider:nwc',
  _nwcUrl: null,
  _walletPubkey: null,
  _relayUrl: null,
  _secret: null,
  enabled: false,
  async load () {
    const config = window.localStorage.getItem(this.storageKey)
    if (!config) return null
    const configJSON = JSON.parse(config)
    this._nwcUrl = configJSON.nwcUrl
    this._walletPubkey = configJSON.walletPubkey
    this._relayUrl = configJSON.relayUrl
    this._secret = configJSON.secret
    try {
      await this._updateEnabled()
    } catch (err) {
      console.error(err)
    }
    return configJSON
  },
  async save (config) {
    this._nwcUrl = config.nwcUrl
    const params = parseWalletConnectUrl(config.nwcUrl)
    this._walletPubkey = config.walletPubkey = params.walletPubkey
    this._relayUrl = config.relayUrl = params.relayUrl
    this._secret = config.secret = params.secret
    await this._updateEnabled()
    window.localStorage.setItem(this.storageKey, JSON.stringify(config))
  },
  clear () {
    window.localStorage.removeItem(this.storageKey)
    this._nwcUrl = null
    this.enabled = false
  },
  async _updateEnabled () {
    try {
      // FIXME: this doesn't work since relay responds with EOSE immediately
      // await this.getInfo()
      this.enabled = !!this._nwcUrl && !!this._walletPubkey && !!this._relayUrl && !!this._secret
    } catch (err) {
      console.error(err)
      this.enabled = false
    }
  },
  async encrypt (pubkey, content) {
    if (!this.secret) {
      throw new Error('Missing secret')
    }
    const encrypted = await nip04.encrypt(this._secret, pubkey, content)
    return encrypted
  },
  async decrypt (pubkey, content) {
    if (!this.secret) {
      throw new Error('Missing secret')
    }
    const decrypted = await nip04.decrypt(this._secret, pubkey, content)
    return decrypted
  },
  // WebLN compatible response
  // TODO: use NIP-47 get_info call
  async getInfo () {
    const relayUrl = this._relayUrl
    const walletPubkey = this._walletPubkey
    return new Promise(function (resolve, reject) {
      (async function () {
        const timeout = 5000
        const timer = setTimeout(() => reject(new Error('timeout')), timeout)
        const relay = await Relay.connect(relayUrl)
        const sub = relay.subscribe([
          {
            kinds: [13194],
            authors: [walletPubkey]
          }
        ], {
          onevent (event) {
            clearTimeout(timer)
            sub.close()
            // TODO: verify event
            resolve(event)
          },
          oneose () {
            clearTimeout(timer)
            sub.close()
            reject(new Error('EOSE'))
          }
        })
      })().catch(reject)
    })
  }
}
