import { useEffect } from 'react'
import { SSR } from '@/lib/constants'
export * from '@/wallets/webln'

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

export async function getBalance () {
  if (typeof window.webln === 'undefined') {
    throw new Error('WebLN provider not found')
  }

  if (!window.webln.snEnabledOnce) {
    window.webln.snEnabledOnce = true
    await window.webln.enable()
  }

  // this will prompt the user to unlock the wallet if it's locked
  if (typeof window.webln.getBalance === 'undefined') {
    throw new Error('getBalance not supported')
  }

  const balance = await window.webln.getBalance()
  if (balance.currency !== 'sats') {
    throw new Error('getBalance returned unsupported currency')
  }
  return BigInt(balance.balance * 1000)
}

export function isAvailable () {
  return !SSR && window?.weblnEnabled
}

export function WebLnProvider ({ children }) {
  useEffect(() => {
    const onEnable = () => {
      window.weblnEnabled = true
    }

    const onDisable = () => {
      window.weblnEnabled = false
    }

    if (!window.webln) onDisable()
    else onEnable()

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
