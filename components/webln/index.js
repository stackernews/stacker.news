import { createContext, useContext } from 'react'
import { LNbitsProvider, useLNbits } from './lnbits'
import { NWCProvider, useNWC } from './nwc'
import { useToast } from '../toast'
import { gql, useMutation } from '@apollo/client'

const WebLNContext = createContext({})

function RawWebLNProvider ({ children }) {
  const lnbits = useLNbits()
  const nwc = useNWC()
  const toaster = useToast()
  const [cancelInvoice] = useMutation(gql`
    mutation cancelInvoice($hash: String!, $hmac: String!) {
      cancelInvoice(hash: $hash, hmac: $hmac) {
        id
      }
    }
  `)

  // TODO: switch between providers based on user preference
  const provider = nwc

  const sendPaymentWithToast = function ({ bolt11, hash, hmac }) {
    let canceled = false
    let removeToast = toaster.warning('zap pending', {
      autohide: false,
      onCancel: async () => {
        try {
          await cancelInvoice({ variables: { hash, hmac } })
          canceled = true
          toaster.warning('zap canceled')
          removeToast = undefined
        } catch (err) {
          toaster.danger('failed to cancel zap')
        }
      }
    })
    return provider.sendPayment(bolt11)
      .then(({ preimage }) => {
        removeToast?.()
        toaster.success('zap successful')
        return { preimage }
      }).catch((err) => {
        if (canceled) return
        removeToast?.()
        const reason = err?.message?.toString().toLowerCase() || 'unknown reason'
        toaster.danger(`zap failed: ${reason}`)
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
