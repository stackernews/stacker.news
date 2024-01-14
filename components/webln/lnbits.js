export default {
  storageKey: 'webln:provider:lnbits',
  _url: null,
  _adminKey: null,
  enabled: false,
  async load () {
    const config = window.localStorage.getItem(this.storageKey)
    if (!config) return null
    const configJSON = JSON.parse(config)
    this._url = configJSON.url
    this._adminKey = configJSON.adminKey
    try {
      await this._updateEnabled()
    } catch (err) {
      console.error(err)
    }
    return configJSON
  },
  async save (config) {
    this._url = config.url
    this._adminKey = config.adminKey
    await this._updateEnabled()
    // XXX This is insecure, XSS vulns could lead to loss of funds!
    //   -> check how mutiny encrypts their wallet and/or check if we can leverage web workers
    //   https://thenewstack.io/leveraging-web-workers-to-safely-store-access-tokens/
    window.localStorage.setItem(this.storageKey, JSON.stringify(config))
  },
  clear () {
    window.localStorage.removeItem(this.storageKey)
    this._url = null
    this._adminKey = null
    this.enabled = false
  },
  async getInfo () {
    // https://github.com/getAlby/bitcoin-connect/blob/v3.2.0-alpha/src/connectors/LnbitsConnector.ts
    const response = await this._request(
      'GET',
      '/api/v1/wallet'
    )
    return {
      node: {
        alias: response.name,
        pubkey: ''
      },
      methods: [
        'getInfo',
        'getBalance',
        'sendPayment'
        // TODO: support makeInvoice and sendPaymentAsync
      ],
      version: '1.0',
      supports: ['lightning']
    }
  },
  async sendPayment (bolt11) {
    const response = await this._request(
      'POST',
      '/api/v1/payments',
      {
        bolt11,
        out: true
      }
    )

    const checkResponse = await this._request(
      'GET',
      `/api/v1/payments/${response.payment_hash}`
    )

    if (!checkResponse.preimage) {
      throw new Error('No preimage')
    }
    return {
      preimage: checkResponse.preimage
    }
  },
  async _request (method, path, args) {
    if (!(this._url && this._adminKey)) throw new Error('provider not configured')
    // https://github.com/getAlby/bitcoin-connect/blob/v3.2.0-alpha/src/connectors/LnbitsConnector.ts
    let body = null
    const query = ''
    const headers = new Headers()
    headers.append('Accept', 'application/json')
    headers.append('Content-Type', 'application/json')
    headers.append('X-Api-Key', this._adminKey)

    if (method === 'POST') {
      body = JSON.stringify(args)
    } else if (args !== undefined) {
      throw new Error('TODO: support args in GET')
      // query = ...
    }
    const url = this._url.replace(/\/+$/, '')
    const res = await fetch(url + path + query, {
      method,
      headers,
      body
    })
    if (!res.ok) {
      const errBody = await res.json()
      throw new Error(errBody.detail)
    }
    return (await res.json())
  },
  async _updateEnabled () {
    if (!(this._url && this._adminKey)) {
      this.enabled = false
      return
    }
    await this.getInfo()
    this.enabled = true
  }
}
