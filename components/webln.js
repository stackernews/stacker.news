import { createContext, createRef, useCallback, useContext, useEffect, useState } from 'react'

const WebLNContext = createContext({})
export const WebLNContextRef = createRef()

const lnbits = {
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
      await this.updateEnabled()
    } catch (err) {
      console.error(err)
    }
    return configJSON
  },
  async save (config) {
    this._url = config.url
    this._adminKey = config.adminKey
    await this.updateEnabled()
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
  async updateEnabled () {
    if (!(this._url && this._adminKey)) {
      this.enabled = false
      return
    }
    await this.getInfo()
    this.enabled = true
  },
  async _request (method, path, args) {
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
  }
}

const _providers = { lnbits }

export function WebLNProvider ({ children }) {
  const [providers, setProviders] = useState(_providers)

  useEffect(() => {
    const initProvider = async key => {
      const config = await _providers[key].load()
      const { enabled } = _providers[key]
      setProviders(p => ({ ...p, [key]: { config, enabled } }))
    }
    // init providers on client
    initProvider('lnbits')
    // TODO support more WebLN providers
  }, [])

  const setConfig = useCallback(async (key, config) => {
    await _providers[key].save(config)
    const { enabled } = _providers[key]
    setProviders(p => ({ ...p, [key]: { ...p[key], config, enabled } }))
  }, [providers])

  const clearConfig = useCallback(async (key) => {
    await _providers[key].clear()
    const { enabled } = _providers[key]
    setProviders(p => ({ ...p, [key]: { ...p[key], config: null, enabled } }))
  }, [providers])

  return (
    <WebLNContext.Provider value={{ provider: providers, setConfig, clearConfig }}>
      {children}
    </WebLNContext.Provider>
  )
}

export function useWebLN (key) {
  const { provider, setConfig: _setConfig, clearConfig: _clearConfig } = useContext(WebLNContext)

  const p = provider[key]
  const { config, enabled } = p
  const setConfig = (config) => _setConfig(key, config)
  const clearConfig = () => _clearConfig(key)

  return { config, setConfig, clearConfig, enabled }
}
