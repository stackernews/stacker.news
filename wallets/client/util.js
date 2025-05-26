import wallets from './wallets.json'
import protocols from './protocols.json'
function walletJson (name) {
  return wallets.find(wallet => wallet.name === name)
}

function protocolJson ({ name, send }) {
  return protocols.find(protocol => protocol.name === name && protocol.send === send)
}

export function walletDisplayName (name) {
  return walletJson(name)?.displayName || titleCase(name)
}

export function protocolDisplayName ({ name, send }) {
  return protocolJson({ name, send })?.displayName || titleCase(name)
}

export function walletImage (name) {
  return walletJson(name)?.image
}

function titleCase (name) {
  return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
}

export function urlify (name) {
  return name.toLowerCase().replace(/_/g, '-')
}

export function unurlify (urlName) {
  return urlName.toUpperCase().replace(/-/g, '_')
}

export function protocolFields ({ name, send }) {
  return protocolJson({ name, send })?.fields || []
}
