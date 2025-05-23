import wallets from './wallets.json'

function walletJson (name) {
  return wallets.find(wallet => wallet.name === name)
}

export function walletDisplayName (name) {
  return walletJson(name)?.displayName ||
    name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
}

export function walletImage (name) {
  return walletJson(name)?.image
}

export function urlify (name) {
  return name.toLowerCase().replace(/_/g, '-')
}

export function unurlify (urlName) {
  return urlName.toUpperCase().replace(/-/g, '_')
}
