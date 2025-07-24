import { WalletError } from '@/wallets/client/errors'

export const name = 'WEBLN'

export async function sendPayment (bolt11) {
  if (typeof window.webln === 'undefined') {
    throw new WalletError('lightning browser extension not found')
  }

  // this will prompt the user to unlock the wallet if it's locked
  try {
    await window.webln.enable()
  } catch (err) {
    throw new WalletError(err.message)
  }

  // this will prompt for payment if no budget is set
  const response = await window.webln.sendPayment(bolt11)
  if (!response) {
    // sendPayment returns nothing if WebLN was enabled
    // but browser extension that provides WebLN was then disabled
    // without reloading the page
    throw new WalletError('sendPayment returned no response')
  }

  return response.preimage
}

export async function testSendPayment () {
  if (typeof window.webln === 'undefined') {
    throw new WalletError('lightning browser extension not found')
  }
}
