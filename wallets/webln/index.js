import { useEffect } from 'react'
import { useWallet } from 'wallets'

export const name = 'webln'

export const fields = []

export const fieldValidation = ({ enabled }) => {
  if (typeof window.webln === 'undefined') {
    // don't prevent disabling WebLN if no WebLN provider found
    if (enabled) {
      return {
        enabled: 'no WebLN provider found'
      }
    }
  }
  return {}
}

export const card = {
  title: 'WebLN',
  subtitle: 'use a [WebLN provider](https://www.webln.guide/ressources/webln-providers) for payments',
  badges: ['send only']
}

export default function WebLnProvider ({ children }) {
  const wallet = useWallet(name)

  useEffect(() => {
    const onEnable = () => {
      wallet.enablePayments()
    }

    const onDisable = () => {
      wallet.disablePayments()
    }

    if (wallet.enabled && typeof window.webln === 'undefined') {
      // automatically disable WebLN if extension no longer found
      onDisable()
    }

    window.addEventListener('webln:enabled', onEnable)
    // event is not fired by Alby browser extension but added here for sake of completeness
    window.addEventListener('webln:disabled', onDisable)
    return () => {
      window.removeEventListener('webln:enabled', onEnable)
      window.removeEventListener('webln:disabled', onDisable)
    }
  }, [])

  return children
}
