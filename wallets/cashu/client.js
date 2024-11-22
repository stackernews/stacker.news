import { getWallet, createWallet } from 'wallets/cashu/common'
export * from 'wallets/cashu'

export async function testSendPayment ({ privKey, walletName, relays, mints }, { logger }) {
  relays = relays.split(',')
  mints = mints.split(',')
  let wallet
  try {
    wallet = await getWallet({ privKey, relays, walletName, mints, logger })
  } catch (e) {
    wallet = await createWallet({ privKey, relays, walletName, mints, logger })
  }
  console.log('Wallet', wallet)
}

export async function sendPayment (bolt11, { privKey, walletName, relays, mints }, { logger }) {
  relays = relays.split(',')
  mints = mints.split(',')
  const wallet = await getWallet({ privKey, relays, walletName, mints, logger })
  if (!wallet) throw new Error('Wallet not found')
  const res = await wallet.lnPay({ pr: bolt11 })
  if (!res) throw new Error('Payment failed')
  return res.preimage
}
