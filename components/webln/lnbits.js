import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useWalletLogger } from '../logger'
import lnpr from 'bolt11'

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
  const [initialized, setInitialized] = useState(false)
  const logger = useWalletLogger('lnbits')

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
    const inv = lnpr.decode(bolt11)
    const hash = inv.tagsObject.payment_hash
    logger.info('sending payment:', `payment_hash=${hash}`)
    try {
      const response = await postPayment(url, adminKey, bolt11)
      const checkResponse = await getPayment(url, adminKey, response.payment_hash)
      if (!checkResponse.preimage) {
        throw new Error('No preimage')
      }
      const preimage = checkResponse.preimage
      logger.ok('payment successful:', `payment_hash=${hash}`, `preimage=${preimage}`)
      return { preimage }
    } catch (err) {
      logger.error('payment failed:', `payment_hash=${hash}`, err.message || err.toString?.())
      throw err
    }
  }, [logger, url, adminKey])

  const loadConfig = useCallback(async () => {
    const configStr = window.localStorage.getItem(storageKey)
    if (!configStr) {
      setEnabled(undefined)
      setInitialized(true)
      logger.info('no existing config found')
      return
    }

    const config = JSON.parse(configStr)

    const { url, adminKey } = config
    setUrl(url)
    setAdminKey(adminKey)

    logger.info(
      'loaded wallet config: ' +
      'adminKey=****** ' +
      `url=${url}`)

    try {
      // validate config by trying to fetch wallet
      logger.info('trying to fetch wallet')
      await getWallet(url, adminKey)
      logger.ok('wallet found')
      setEnabled(true)
      logger.ok('wallet enabled')
    } catch (err) {
      logger.error('invalid config:', err)
      setEnabled(false)
      logger.info('wallet disabled')
      throw err
    } finally {
      setInitialized(true)
    }
  }, [logger])

  const saveConfig = useCallback(async (config) => {
    // immediately store config so it's not lost even if config is invalid
    setUrl(config.url)
    setAdminKey(config.adminKey)

    // XXX This is insecure, XSS vulns could lead to loss of funds!
    //   -> check how mutiny encrypts their wallet and/or check if we can leverage web workers
    //   https://thenewstack.io/leveraging-web-workers-to-safely-store-access-tokens/
    window.localStorage.setItem(storageKey, JSON.stringify(config))

    logger.info(
      'saved wallet config: ' +
      'adminKey=****** ' +
      `url=${config.url}`)

    try {
      // validate config by trying to fetch wallet
      logger.info('trying to fetch wallet')
      await getWallet(config.url, config.adminKey)
      logger.ok('wallet found')
    } catch (err) {
      logger.error('invalid config:', err)
      setEnabled(false)
      logger.info('wallet disabled')
      throw err
    }
    setEnabled(true)
    logger.ok('wallet enabled')
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

  const value = { name, url, adminKey, initialized, enabled, saveConfig, clearConfig, getInfo, sendPayment }
  return (
    <LNbitsContext.Provider value={value}>
      {children}
    </LNbitsContext.Provider>
  )
}

export function useLNbits () {
  return useContext(LNbitsContext)
}
