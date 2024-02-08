import { createContext, useContext, useEffect, useState } from 'react'
import { LNbitsProvider, useLNbits } from './lnbits'
import { NWCProvider, useNWC } from './nwc'
import { useToast } from '../toast'
import { gql, useMutation } from '@apollo/client'

const WebLNContext = createContext({})
const storageKey = 'webln:providers'

const paymentMethodHook = (methods, { name, enabled }) => {
  let newMethods
  if (enabled) {
    newMethods = methods.includes(name) ? methods : [...methods, name]
  } else {
    newMethods = methods.filter(m => m !== name)
  }
  savePaymentMethods(newMethods)
  return newMethods
}

const savePaymentMethods = (methods) => {
  window.localStorage.setItem(storageKey, JSON.stringify(methods))
}

function RawWebLNProvider ({ children }) {
  // LNbits should only be used during development
  // since it gives full wallet access on XSS
  const lnbits = useLNbits()
  const nwc = useNWC()
  const providers = [lnbits, nwc]

  // order of payment methods depends on user preference:
  // payment method at index 0 is default, if that one fails
  // we try the remaining ones in order as fallbacks.
  // -- TODO: implement fallback logic
  // eslint-disable-next-line no-unused-vars
  const [paymentMethods, setPaymentMethods] = useState([])
  const loadPaymentMethods = () => {
    const methods = window.localStorage.getItem(storageKey)
    if (!methods) return
    setPaymentMethods(JSON.parse(methods))
  }
  useEffect(loadPaymentMethods, [])

  const toaster = useToast()
  const [cancelInvoice] = useMutation(gql`
    mutation cancelInvoice($hash: String!, $hmac: String!) {
      cancelInvoice(hash: $hash, hmac: $hmac) {
        id
      }
    }
  `)

  useEffect(() => {
    setPaymentMethods(methods => paymentMethodHook(methods, nwc))
    if (!nwc.enabled) nwc.setIsDefault(false)
  }, [nwc.enabled])

  useEffect(() => {
    setPaymentMethods(methods => paymentMethodHook(methods, lnbits))
    if (!lnbits.enabled) lnbits.setIsDefault(false)
  }, [lnbits.enabled])

  const setDefaultPaymentMethod = (provider) => {
    for (const p of providers) {
      if (p.name !== provider.name) {
        p.setIsDefault(false)
      }
    }
  }

  useEffect(() => {
    if (nwc.isDefault) setDefaultPaymentMethod(nwc)
  }, [nwc.isDefault])

  useEffect(() => {
    if (lnbits.isDefault) setDefaultPaymentMethod(lnbits)
  }, [lnbits.isDefault])

  // TODO: implement numeric provider priority
  // when we have more than two providers for sending
  let provider = providers.filter(p => p.enabled && p.isDefault)[0]
  if (!provider && providers.length > 0) {
    // if no provider is the default, pick the first one and use that one as the default
    provider = providers.filter(p => p.enabled)[0]
    if (provider) {
      provider.setIsDefault(true)
    }
  }

  const sendPaymentWithToast = function ({ bolt11, hash, hmac }) {
    let canceled = false
    let removeToast = toaster.warning('payment pending', {
      autohide: false,
      onCancel: async () => {
        try {
          await cancelInvoice({ variables: { hash, hmac } })
          canceled = true
          toaster.warning('payment canceled')
          removeToast = undefined
        } catch (err) {
          toaster.danger('failed to cancel payment')
        }
      }
    })
    return provider.sendPayment(bolt11)
      .then(({ preimage }) => {
        removeToast?.()
        toaster.success('payment successful')
        return { preimage }
      }).catch((err) => {
        if (canceled) return
        removeToast?.()
        const reason = err?.message?.toString().toLowerCase() || 'unknown reason'
        toaster.danger(`payment failed: ${reason}`)
        throw err
      })
  }

  return (
    <WebLNContext.Provider value={{ ...provider, sendPayment: sendPaymentWithToast }}>
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
  return useContext(WebLNContext)
}
