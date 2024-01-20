import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import LNbitsProvider from './lnbits'
import NWCProvider from './nwc'

const WebLNContext = createContext({})

const _providers = { lnbits: LNbitsProvider, nwc: NWCProvider }

export function WebLNProvider ({ children }) {
  const [providers, setProviders] = useState(_providers)

  useEffect(() => {
    const initProvider = async key => {
      const config = await _providers[key].load()
      const pkey = _providers[key]
      setProviders(p => ({
        ...p,
        [key]: {
          config,
          enabled: pkey.enabled,
          sendPayment: pkey.sendPayment?.bind(pkey)
        }
      }))
    }
    // init providers on client
    initProvider('lnbits')
    initProvider('nwc')
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

  if (!key) {
    // TODO pick preferred enabled WebLN provider here
    key = 'nwc'
  }

  const p = provider[key]
  const { config, enabled } = p
  const setConfig = (config) => _setConfig(key, config)
  const clearConfig = () => _clearConfig(key)

  return { name: key, config, setConfig, clearConfig, enabled, sendPayment: p.sendPayment.bind(p) }
}
