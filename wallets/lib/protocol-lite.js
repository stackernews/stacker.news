import wallets from '@/wallets/lib/wallets.json'

const protocols = [
  {
    name: 'NWC',
    send: true,
    displayName: 'Nostr Wallet Connect',
    logName: 'NWC',
    relationName: 'walletSendNWC',
    encryptedFields: ['url']
  },
  {
    name: 'NWC',
    send: false,
    displayName: 'Nostr Wallet Connect',
    logName: 'NWC',
    relationName: 'walletRecvNWC'
  },
  {
    name: 'LN_ADDR',
    send: false,
    displayName: 'Lightning Address',
    relationName: 'walletRecvLightningAddress'
  },
  {
    name: 'CLN_REST',
    send: false,
    displayName: 'CLNRest',
    relationName: 'walletRecvCLNRest'
  },
  {
    name: 'CLN_REST',
    send: true,
    displayName: 'CLNRest',
    relationName: 'walletSendCLNRest',
    encryptedFields: ['rune']
  },
  {
    name: 'LND_GRPC',
    send: false,
    displayName: 'gRPC',
    relationName: 'walletRecvLNDGRPC'
  },
  {
    name: 'LNC',
    send: true,
    displayName: 'Lightning Node Connect',
    relationName: 'walletSendLNC',
    encryptedFields: ['pairingPhrase', 'serverHost', 'localKey', 'remoteKey']
  },
  {
    name: 'PHOENIXD',
    send: true,
    displayName: 'API',
    relationName: 'walletSendPhoenixd',
    encryptedFields: ['apiKey']
  },
  {
    name: 'PHOENIXD',
    send: false,
    displayName: 'API',
    relationName: 'walletRecvPhoenixd'
  },
  {
    name: 'LNBITS',
    send: true,
    displayName: 'API',
    relationName: 'walletSendLNbits',
    encryptedFields: ['apiKey']
  },
  {
    name: 'LNBITS',
    send: false,
    displayName: 'API',
    relationName: 'walletRecvLNbits'
  },
  {
    name: 'BLINK',
    send: true,
    displayName: 'API',
    relationName: 'walletSendBlink',
    encryptedFields: ['apiKey', 'currency']
  },
  {
    name: 'BLINK',
    send: false,
    displayName: 'API',
    relationName: 'walletRecvBlink'
  },
  {
    name: 'WEBLN',
    send: true,
    displayName: 'WebLN',
    relationName: 'walletSendWebLN',
    isAvailable: () => typeof window !== 'undefined' && window?.weblnEnabled
  },
  {
    name: 'CLINK',
    send: false,
    displayName: 'CLINK',
    relationName: 'walletRecvClink'
  },
  {
    name: 'CLINK',
    send: true,
    displayName: 'CLINK',
    relationName: 'walletSendClink',
    encryptedFields: ['ndebit', 'secretKey']
  }
]

function protocol ({ name, send }) {
  return protocols.find(protocol => protocol.name === name && protocol.send === send)
}

function walletJson (name) {
  return wallets.find(wallet => wallet.name === name)
}

export function isWallet (wallet) {
  return !isTemplate(wallet)
}

export function isTemplate (obj) {
  return obj.__typename.endsWith('Template')
}

export function protocolAvailable ({ name, send }) {
  const isAvailable = protocol({ name, send })?.isAvailable
  return typeof isAvailable === 'function' ? isAvailable() : true
}

export function protocolLogName ({ name, send }) {
  const metadata = protocol({ name, send })
  return metadata?.logName ?? metadata?.displayName ?? titleCase(name)
}

export function reverseProtocolRelationName (relationName) {
  return protocols.find(protocol => protocol.relationName.toLowerCase() === relationName.toLowerCase())
}

export function isEncryptedField (protocolLike, key) {
  return protocol(protocolLike)?.encryptedFields?.includes(key) ?? false
}

export function walletLud16Domain (name) {
  const url = walletJson(name)?.url
  if (!url) return undefined

  return typeof url === 'string' ? new URL(url).hostname : url.lud16Domain
}

function titleCase (name) {
  return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
}
