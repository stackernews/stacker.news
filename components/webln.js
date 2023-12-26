import { createContext, createRef, useCallback, useContext, useEffect, useState } from 'react'

const WebLNContext = createContext({})
export const WebLNContextRef = createRef()

const lnbits = {
  storageKey: 'webln:provider:lnbits',
  load () {
    const config = window.localStorage.getItem(this.storageKey)
    if (config) return JSON.parse(config)
    return null
  },
  save (config) {
    // XXX This is insecure, XSS vulns could lead to loss of funds!
    //   -> check how mutiny encrypts their wallet and/or check if we can leverage web workers
    //   https://thenewstack.io/leveraging-web-workers-to-safely-store-access-tokens/
    window.localStorage.setItem(this.storageKey, JSON.stringify(config))
  },
  remove () {
    window.localStorage.removeItem(this.storageKey)
  }
}

const providers = { lnbits }

export function WebLNProvider ({ children }) {
  const [provider, setProvider] = useState({})

  useEffect(() => {
    // init providers on client
    setProvider(p => ({ ...p, lnbits: providers.lnbits.load() }))
    // TODO support more WebLN providers
  }, [])

  return (
    <WebLNContext.Provider value={{ provider, setProvider }}>
      {children}
    </WebLNContext.Provider>
  )
}

export function useWebLN (key) {
  const { provider, setProvider } = useContext(WebLNContext)
  const config = provider[key]

  const setConfig = useCallback((config) => {
    providers[key].save(config)
    setProvider(p => ({ ...p, [key]: config }))
  }, [])

  const clearConfig = () => {
    providers[key].remove?.()
    setProvider(p => ({ ...p, [key]: null }))
  }

  return { config, setConfig, clearConfig, isEnabled: !!config }
}
