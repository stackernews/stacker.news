import cln from '@/wallets/json/cln.json'
import lnbits from '@/wallets/json/lnbits.json'
import blink from '@/wallets/json/blink.json'
import phoenixd from '@/wallets/json/phoenixd.json'
import lnd from '@/wallets/json/lnd.json'

// TODO(wallet-v2): generate this file from the JSON files

const walletJsons = [cln, lnbits, blink, phoenixd, lnd]

function getWalletJson (name) {
  return walletJsons.find(w => w.name === name)
}

export function walletNameToImage (name) {
  return getWalletJson(name)?.image
}

export function walletNameToDisplayName (name) {
  return getWalletJson(name)?.displayName ||
    name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
}

export function walletNameToUrlName (name) {
  return name.toLowerCase().replace(/_/g, '-')
}

export function urlNameToWalletName (urlName) {
  return urlName.toUpperCase().replace(/-/g, '_')
}
