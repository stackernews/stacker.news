import { useEffect } from 'react'
import { useWallet } from 'wallets'
import { name } from 'wallets/blink'
export * from 'wallets/webln'

export const sendPayment = async (bolt11) => {
  if (typeof window.webln === 'undefined') {
    throw new Error('WebLN provider not found')
  }

  // this will prompt the user to unlock the wallet if it's locked
  await window.webln.enable()

  // this will prompt for payment if no budget is set
  const response = await window.webln.sendPayment(bolt11)
  if (!response) {
    // sendPayment returns nothing if WebLN was enabled
    // but browser extension that provides WebLN was then disabled
    // without reloading the page
    throw new Error('sendPayment returned no response')
  }

  return response.preimage
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

    if (!window.webln) onDisable()

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
