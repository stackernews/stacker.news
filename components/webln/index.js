import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { LNbitsProvider, useLNbits } from './lnbits'
import { NWCProvider, useNWC } from './nwc'
import { useToast, withToastFlow } from '@/components/toast'
import { gql, useMutation } from '@apollo/client'
import { LNCProvider, useLNC } from './lnc'

const WebLNContext = createContext({})

const isEnabled = p => [Status.Enabled, Status.Locked].includes(p?.status)

const syncProvider = (array, provider) => {
  const idx = array.findIndex(({ name }) => provider.name === name)
  const enabled = isEnabled(provider)
  if (idx === -1) {
    // add provider to end if enabled
    return enabled ? [...array, provider] : array
  }
  return [
    ...array.slice(0, idx),
    // remove provider if not enabled
    ...enabled ? [provider] : [],
    ...array.slice(idx + 1)
  ]
}

const storageKey = 'webln:providers'

export const Status = {
  Initialized: 'Initialized',
  Enabled: 'Enabled',
  Locked: 'Locked',
  Error: 'Error'
}

export function migrateLocalStorage (oldStorageKey, newStorageKey) {
  const item = window.localStorage.getItem(oldStorageKey)
  if (item) {
    window.localStorage.setItem(newStorageKey, item)
    window.localStorage.removeItem(oldStorageKey)
  }
  return item
}

function RawWebLNProvider ({ children }) {
  const lnbits = useLNbits()
  const nwc = useNWC()
  const lnc = useLNC()
  const availableProviders = [lnbits, nwc, lnc]
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
      const isInitialized = p => [Status.Enabled, Status.Locked, Status.Initialized].includes(p.status)
      const newProviders = availableProviders.filter(isInitialized).reduce(syncProvider, providers)
      const newOrder = newProviders.map(({ name }) => name)
      window.localStorage.setItem(storageKey, JSON.stringify(newOrder))
      return newProviders
    })
  }, [...availableProviders])

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
    ({ bolt11, hash, hmac, expiresAt, flowId }) => {
      const expiresIn = (+new Date(expiresAt)) - (+new Date())
      return {
        flowId: flowId || hash,
        type: 'payment',
        onPending: async () => {
          await provider.sendPayment(bolt11)
        },
        // hash and hmac are only passed for JIT invoices
        onCancel: () => hash && hmac ? cancelInvoice({ variables: { hash, hmac } }) : undefined,
        timeout: expiresIn
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

  const clearConfig = useCallback(async () => {
    lnbits.clearConfig()
    nwc.clearConfig()
    await lnc.clearConfig()
  }, [])

  return (
    <WebLNContext.Provider value={{ provider: isEnabled(provider) ? { name: provider.name, sendPayment: sendPaymentWithToast } : null, enabledProviders, setProvider, clearConfig }}>
      {children}
    </WebLNContext.Provider>
  )
}

export function WebLNProvider ({ children }) {
  return (
    <LNbitsProvider>
      <NWCProvider>
        <LNCProvider>
          <RawWebLNProvider>
            {children}
          </RawWebLNProvider>
        </LNCProvider>
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
