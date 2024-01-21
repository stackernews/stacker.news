import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// Reference: https://github.com/getAlby/bitcoin-connect/blob/v3.2.0-alpha/src/connectors/LnbitsConnector.ts

const LNbitsContext = createContext()

export function LNbitsProvider ({ children }) {
  const [url, setUrl] = useState()
  const [adminKey, setAdminKey] = useState()
  const [enabled, setEnabled] = useState()

  const storageKey = 'webln:provider:lnbits'

  const request = useCallback(async (method, path, args) => {
    let body = null
    const query = ''
    const headers = new Headers()
    headers.append('Accept', 'application/json')
    headers.append('Content-Type', 'application/json')
    headers.append('X-Api-Key', adminKey)

    if (method === 'POST') {
      body = JSON.stringify(args)
    } else if (args !== undefined) {
      throw new Error('TODO: support args in GET')
      // query = ...
    }
    const url_ = url.replace(/\/+$/, '')
    const res = await fetch(url_ + path + query, {
      method,
      headers,
      body
    })
    if (!res.ok) {
      const errBody = await res.json()
      throw new Error(errBody.detail)
    }
    return (await res.json())
  }, [url, adminKey])

  const getInfo = useCallback(async () => {
    const response = await request(
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
  }, [request])

  const sendPayment = useCallback(async (bolt11) => {
    const response = await request(
      'POST',
      '/api/v1/payments',
      {
        bolt11,
        out: true
      }
    )
    const checkResponse = await request(
      'GET',
      `/api/v1/payments/${response.payment_hash}`
    )
    if (!checkResponse.preimage) {
      throw new Error('No preimage')
    }
    return {
      preimage: checkResponse.preimage
    }
  }, [request])

  const loadConfig = useCallback(() => {
    const config = window.localStorage.getItem(storageKey)
    if (!config) return null
    const configJSON = JSON.parse(config)
    setUrl(configJSON.url)
    setAdminKey(configJSON.adminKey)
  }, [])

  const saveConfig = useCallback(async (config) => {
    setUrl(config.url)
    setAdminKey(config.adminKey)
    // XXX This is insecure, XSS vulns could lead to loss of funds!
    //   -> check how mutiny encrypts their wallet and/or check if we can leverage web workers
    //   https://thenewstack.io/leveraging-web-workers-to-safely-store-access-tokens/
    window.localStorage.setItem(storageKey, JSON.stringify(config))
  }, [])

  const clearConfig = useCallback(() => {
    window.localStorage.removeItem(storageKey)
    setUrl(null)
    setAdminKey(null)
    setEnabled(false)
  }, [])

  useEffect(() => {
    (async function () {
      if (!(url && adminKey)) return setEnabled(false)
      try {
        await getInfo()
        setEnabled(true)
      } catch (err) {
        console.error(err)
        setEnabled(false)
      }
    })()
  }, [url, adminKey, getInfo])

  useEffect(loadConfig, [])

  const value = { url, adminKey, saveConfig, clearConfig, enabled, sendPayment }
  return (
    <LNbitsContext.Provider value={value}>
      {children}
    </LNbitsContext.Provider>
  )
}

export function useLNbits () {
  return useContext(LNbitsContext)
}
