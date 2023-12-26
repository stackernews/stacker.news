import { createContext, createRef, useContext, useEffect, useImperativeHandle, useState } from 'react'

const WebLNContext = createContext({})
export const WebLNContextRef = createRef()

const fetchWebLNProvider = async () => {
  // sync provider from local storage
  // TODO check if there is a better, more secure option
  const configJson = window.localStorage.getItem('bc:config')
  if (configJson) {
    const WebLNProviders = await import('@getalby/bitcoin-connect').then((mod) => mod.WebLNProviders)
    const config = JSON.parse(configJson)
    if (config.connectorType === 'lnbits') return new WebLNProviders.LnbitsWebLNProvider(config.lnbitsInstanceUrl, config.lnbitsAdminKey)
    // TODO implement other connector types
  }
}

export function WebLNProvider ({ children }) {
  const [provider, setProvider] = useState(null)
  const [info, setInfo] = useState(null)
  const [balance, setBalance] = useState(0)

  const initProvider = async (provider) => {
    const WebLNProviders = await import('@getalby/bitcoin-connect').then((mod) => mod.WebLNProviders)
    if (provider instanceof WebLNProviders.LnbitsWebLNProvider) {
      const connector = 'lnbits'
      // TODO
      //   we're reaching into private parts here.
      //   is there a better way to show to user which connection was used?
      const { hostname: connection } = new URL(provider._instanceUrl)
      setInfo(o => ({ ...o, connector, connection }))
    }
    setProvider(provider)
    const info = await provider.getInfo()
    setInfo(o => ({ ...o, ...info }))
    const { balance } = await provider.getBalance()
    setBalance(balance)
  }

  const clearProvider = () => {
    setProvider(null)
    setInfo(null)
  }

  useEffect(() => {
    async function effect () {
      const provider = await fetchWebLNProvider()
      if (!provider) return
      initProvider(provider)
    }
    effect().catch(console.error)
  }, [])

  // event listeners
  useEffect(() => {
    let onConnectedUnsub
    let onDisconnectedUnsub
    async function effect () {
      const onConnected = await import('@getalby/bitcoin-connect-react').then((mod) => mod.onConnected)
      onConnectedUnsub = onConnected(async (provider) => {
        // TODO
        //   why is this not fired on page load when there is a provider available in local storage?
        //   why do i have to do this myself?
        // console.log('webln:: connected', provider)
        // TODO do we need this?
        // window.webln = provider
        initProvider(provider)
      })
      const onDisconnected = await import('@getalby/bitcoin-connect-react').then((mod) => mod.onDisconnected)
      onDisconnectedUnsub = onDisconnected(() => {
        // console.log('webln:: disconnected')
        clearProvider()
      })
    }
    effect().catch(console.error)
    return () => {
      onConnectedUnsub?.()
      onDisconnectedUnsub?.()
    }
  }, [])

  // poll balance
  useEffect(() => {
    if (!provider) return
    const BALANCE_POLL = 15000 // 1 minute
    const interval = setInterval(() => {
      provider?.getBalance().then(({ balance }) => setBalance(balance)).catch(console.error)
    }, BALANCE_POLL)
    return () => clearInterval(interval)
  }, [provider])

  const value = { provider, setProvider, info, balance }

  // required to resolve fields marked with @client using values from WebLN context
  useImperativeHandle(WebLNContextRef, () => value)

  return (
    <WebLNContext.Provider value={value}>
      {children}
    </WebLNContext.Provider>
  )
}

export function useWebLN () {
  return useContext(WebLNContext)
}
