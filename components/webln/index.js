import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { LNbitsProvider, useLNbits } from './lnbits'
import { NWCProvider, useNWC } from './nwc'
import { useToast, withToastFlow } from '../toast'
import { gql, useMutation } from '@apollo/client'

const WebLNContext = createContext({})

const syncProvider = (array, provider) => {
  const idx = array.findIndex(({ name }) => provider.name === name)
  if (idx === -1) {
    // add provider to end if enabled
    return provider.enabled ? [...array, provider] : array
  }
  return [
    ...array.slice(0, idx),
    // remove provider if not enabled
    ...provider.enabled ? [provider] : [],
    ...array.slice(idx + 1)
  ]
}

const storageKey = 'webln:providers'

function RawWebLNProvider ({ children }) {
  const lnbits = useLNbits()
  const nwc = useNWC()
  const availableProviders = [lnbits, nwc]
  const [enabledProviders, setEnabledProviders] = useState([])

  // restore order on page reload
  useEffect(() => {
    const storedOrder = window.localStorage.getItem(storageKey)
    if (!storedOrder) return
    const providerNames = JSON.parse(storedOrder)
    setEnabledProviders(providers => {
      return providerNames.map(name => {
        for (const p of availableProviders) {
          if (p.name === name) return p
        }
        console.warn(`Stored provider with name ${name} not available`)
        return null
      })
    })
  }, [])

  // keep list in sync with underlying providers
  useEffect(() => {
    setEnabledProviders(providers => {
      // Sync existing provider state with new provider state
      // in the list while keeping the order they are in.
      // If provider does not exist but is enabled, it is just added to the end of the list.
      // This can be the case if we're syncing from a page reload
      // where the providers are initially not enabled.
      // If provider is no longer enabled, it is removed from the list.
      const isInitialized = p => p.initialized
      const newProviders = availableProviders.filter(isInitialized).reduce(syncProvider, providers)
      const newOrder = newProviders.map(({ name }) => name)
      window.localStorage.setItem(storageKey, JSON.stringify(newOrder))
      return newProviders
    })
  }, [lnbits, nwc])

  // sanity check
  for (const p of enabledProviders) {
    if (!p.enabled && p.initialized) {
      console.warn('Expected provider to be enabled but is not:', p.name)
    }
  }

  // first provider in list is the default provider
  // TODO: implement fallbacks via provider priority
  const provider = enabledProviders[0]

  const toaster = useToast()
  const [cancelInvoice] = useMutation(gql`
    mutation cancelInvoice($hash: String!, $hmac: String!) {
      cancelInvoice(hash: $hash, hmac: $hmac) {
        id
      }
    }
  `)

  const sendPaymentWithToast = withToastFlow(toaster)(
    ({ bolt11, hash, hmac, flowId }) => {
      return {
        flowId: flowId || hash,
        type: 'payment',
        onPending: () => provider.sendPayment(bolt11),
        // hash and hmac are only passed for JIT invoices
        onCancel: () => hash && hmac ? cancelInvoice({ variables: { hash, hmac } }) : undefined
      }
    }
  )

  const setProvider = useCallback((defaultProvider) => {
    // move provider to the start to set it as default
    setEnabledProviders(providers => {
      const idx = providers.findIndex(({ name }) => defaultProvider.name === name)
      if (idx === -1) {
        console.warn(`tried to set unenabled provider ${defaultProvider.name} as default`)
        return providers
      }
      return [defaultProvider, ...providers.slice(0, idx), ...providers.slice(idx + 1)]
    })
  }, [setEnabledProviders])

  const value = { provider: { ...provider, sendPayment: sendPaymentWithToast }, enabledProviders, setProvider }
  return (
    <WebLNContext.Provider value={value}>
      {children}
    </WebLNContext.Provider>
  )
}

export function WebLNProvider ({ children }) {
  return (
    <LNbitsProvider>
      <NWCProvider>
        <RawWebLNProvider>
          {children}
        </RawWebLNProvider>
      </NWCProvider>
    </LNbitsProvider>
  )
}

export function useWebLN () {
  const { provider } = useContext(WebLNContext)
  return provider
}

export function useWebLNConfigurator () {
  return useContext(WebLNContext)
}
