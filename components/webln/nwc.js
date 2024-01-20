// https://github.com/getAlby/js-sdk/blob/master/src/webln/NostrWeblnProvider.ts

import { Relay, finalizeEvent, nip04 } from 'nostr-tools'

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
    if (!(this._nwcUrl && this._walletPubkey && this._relayUrl && this._secret)) {
      this.enabled = false
      return
    }
    try {
      await this.getInfo()
      this.enabled = true
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
  async sendPayment (bolt11) {
    const relayUrl = this._relayUrl
    const walletPubkey = this._walletPubkey
    const secret = this._secret
    return new Promise(function (resolve, reject) {
      (async function () {
        // need big timeout since NWC is async (user needs to confirm payment in wallet)
        const timeout = 60000
        let timer
        const resetTimer = () => {
          clearTimeout(timer)
          timer = setTimeout(() => reject(new Error('timeout')), timeout)
        }
        resetTimer()
        const relay = await Relay.connect(relayUrl)
        const payload = {
          method: 'pay_invoice',
          params: { invoice: bolt11 }
        }
        const content = await nip04.encrypt(secret, walletPubkey, JSON.stringify(payload))
        const request = finalizeEvent({
          pubkey: walletPubkey,
          kind: 23194,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content
        }, secret)
        await relay.publish(request)
        const sub = relay.subscribe([
          {
            kinds: [23195],
            authors: [walletPubkey],
            '#e': [request.id]
          }
        ], {
          async onevent (response) {
            resetTimer()
            try {
              const content = JSON.parse(await nip04.decrypt(secret, walletPubkey, response.content))
              if (content.error) return reject(new Error(content.error.message))
              if (content.result) return resolve(content.result.preimage)
            } catch (err) {
              return reject(err)
            } finally {
              clearTimeout(timer)
              sub.close()
            }
          }
        })
      })().catch(reject)
    })
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
          // some relays like nostr.mutinywallet.com don't support NIP-47 info events
          // so we simply check that we received EOSE
          oneose () {
            clearTimeout(timer)
            sub.close()
            resolve()
          }
        })
      })().catch(reject)
    })
  }
}
