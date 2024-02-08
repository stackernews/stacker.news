import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// Reference: https://github.com/getAlby/bitcoin-connect/blob/v3.2.0-alpha/src/connectors/LnbitsConnector.ts

const LNbitsContext = createContext()

const getWallet = async (baseUrl, adminKey) => {
  const url = baseUrl.replace(/\/+$/, '')
  const path = '/api/v1/wallet'

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', adminKey)

  const res = await fetch(url + path, { method: 'GET', headers })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }
  const wallet = await res.json()
  return wallet
}

const postPayment = async (baseUrl, adminKey, bolt11) => {
  const url = baseUrl.replace(/\/+$/, '')
  const path = '/api/v1/payments'

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', adminKey)

  const body = JSON.stringify({ bolt11, out: true })

  const res = await fetch(url + path, { method: 'POST', headers, body })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }
  const payment = await res.json()
  return payment
}

const getPayment = async (baseUrl, adminKey, paymentHash) => {
  const url = baseUrl.replace(/\/+$/, '')
  const path = `/api/v1/payments/${paymentHash}`

  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', adminKey)

  const res = await fetch(url + path, { method: 'GET', headers })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }
  const payment = await res.json()
  return payment
}

export function LNbitsProvider ({ children }) {
  const [url, setUrl] = useState('')
  const [adminKey, setAdminKey] = useState('')
  const [enabled, setEnabled] = useState()
  const [isDefault, setIsDefault] = useState()

  const name = 'LNbits'
  const storageKey = 'webln:provider:lnbits'

  const getInfo = useCallback(async () => {
    const response = await getWallet(url, adminKey)
    return {
      node: {
        alias: response.name,
        pubkey: ''
      },
      methods: [
        'getInfo',
        'getBalance',
        'sendPayment'
      ],
      version: '1.0',
      supports: ['lightning']
    }
  }, [url, adminKey])

  const sendPayment = useCallback(async (bolt11) => {
    const response = await postPayment(url, adminKey, bolt11)
    const checkResponse = await getPayment(url, adminKey, response.payment_hash)
    if (!checkResponse.preimage) {
      throw new Error('No preimage')
    }
    return { preimage: checkResponse.preimage }
  }, [url, adminKey])

  const loadConfig = useCallback(async () => {
    const configStr = window.localStorage.getItem(storageKey)
    if (!configStr) {
      setEnabled(undefined)
      return
    }

    const config = JSON.parse(configStr)

    const { url, adminKey, isDefault } = config
    setUrl(url)
    setAdminKey(adminKey)
    setIsDefault(isDefault)

    try {
      // validate config by trying to fetch wallet
      await getWallet(url, adminKey)
      setEnabled(true)
    } catch (err) {
      console.error('invalid LNbits config:', err)
      setEnabled(false)
      throw err
    }
  }, [])

  const saveConfig = useCallback(async (config) => {
    // immediately store config so it's not lost even if config is invalid
    setUrl(config.url)
    setAdminKey(config.adminKey)
    setIsDefault(config.isDefault)

    // XXX This is insecure, XSS vulns could lead to loss of funds!
    //   -> check how mutiny encrypts their wallet and/or check if we can leverage web workers
    //   https://thenewstack.io/leveraging-web-workers-to-safely-store-access-tokens/
    window.localStorage.setItem(storageKey, JSON.stringify(config))

    try {
      // validate config by trying to fetch wallet
      await getWallet(config.url, config.adminKey)
    } catch (err) {
      console.error('invalid LNbits config:', err)
      setEnabled(false)
      throw err
    }
    setEnabled(true)
  }, [])

  const clearConfig = useCallback(() => {
    window.localStorage.removeItem(storageKey)
    setUrl('')
    setAdminKey('')
    setEnabled(undefined)
  }, [])

  useEffect(() => {
    loadConfig().catch(console.error)
  }, [])

  const value = { name, url, adminKey, saveConfig, clearConfig, enabled, isDefault, setIsDefault, getInfo, sendPayment }
  return (
    <LNbitsContext.Provider value={value}>
      {children}
    </LNbitsContext.Provider>
  )
}

export function useLNbits () {
  return useContext(LNbitsContext)
}
