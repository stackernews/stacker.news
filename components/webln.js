import { createContext, useContext, useEffect, useState } from 'react'

const WebLNContext = createContext({})

export function WebLNProvider ({ children }) {
  const [provider, setProvider] = useState(null)
  const [info, setInfo] = useState(null)
  // NOTE launchModal is undefined initially - can this be a problem?
  const [launchModal, setLaunchModal] = useState()

  useEffect(() => {
    const unsub = []
    async function effect () {
      const [isConnected, onConnected, onDisconnected, requestProvider, launchModal] = await import('@getalby/bitcoin-connect-react').then(
        (mod) => [mod.isConnected, mod.onConnected, mod.onDisconnected, mod.requestProvider, mod.launchModal]
      )

      // if you want to store a function, you need to wrap it with another function because of updater functions
      // see https://react.dev/reference/react/useState#updating-state-based-on-the-previous-state
      setLaunchModal(() => launchModal)

      if (isConnected()) {
        // requestProvider will not launch a modal because a provider is already available.
        // TODO but it might for wallets that must be unlocked?
        const provider = await requestProvider()
        setProvider(provider)
      }
      unsub.push(onConnected(async (provider) => {
        setProvider(provider)
        const info = await provider.getInfo()
        setInfo(info)
      }))
      unsub.push(onDisconnected(() => {
        setProvider(null)
        setInfo(null)
      }))
    }
    effect()

    return () => unsub.forEach(fn => fn())
  }, [setProvider])

  const value = { provider, info, launchModal }
  return (
    <WebLNContext.Provider value={value}>
      {children}
    </WebLNContext.Provider>
  )
}

export function useWebLN () {
  return useContext(WebLNContext)
}
