import { decode as decodeBolt11 } from 'light-bolt11-decoder'

// Client-side BOLT11 parsing is for UX only. Server payment validation remains
// authoritative and continues to use ln-service in the payment path.

const BOLT11_BITCOIN_NETWORKS = [
  {
    name: 'bitcoin regtest',
    prefixes: ['lnbcrt'],
    chainIds: ['0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206']
  },
  {
    name: 'bitcoin signet',
    prefixes: ['lntbs'],
    chainIds: ['00000008819873e925422c1ff0f99f7cc9bbb232af63a077a480a3633bee1ef6']
  },
  {
    name: 'bitcoin testnet',
    prefixes: ['lntb'],
    chainIds: [
      '000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943',
      '00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043'
    ]
  },
  {
    name: 'bitcoin mainnet',
    prefixes: ['lnbc'],
    chainIds: ['000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f']
  }
]

class Bolt11Error extends Error {
  constructor (message) {
    super(message)
    this.name = 'Bolt11Error'
  }
}

class InvalidBolt11Error extends Bolt11Error {
  constructor () {
    super('invalid bolt11 invoice')
    this.name = 'InvalidBolt11Error'
  }
}

class Bolt11AmountMismatchError extends Bolt11Error {
  constructor ({ actualMsats, expectedMsats } = {}) {
    super('invoice has incorrect amount')
    this.name = 'Bolt11AmountMismatchError'
    this.actualMsats = actualMsats
    this.expectedMsats = expectedMsats
  }
}

export function safeDecodeBolt11 (bolt11) {
  if (!bolt11) return null
  try {
    return decodeBolt11(bolt11)
  } catch {
    return null
  }
}

export function bolt11Section (decoded, name) {
  return decoded?.sections?.find(section => section.name === name)
}

export function isBolt11PaymentRequest (value) {
  return Boolean(safeDecodeBolt11(value))
}

export function bolt11Network (bolt11) {
  const normalized = normalizeBolt11PaymentRequest(bolt11).toLowerCase()
  if (!normalized) return null

  return BOLT11_BITCOIN_NETWORKS.find(({ prefixes }) => (
    prefixes.some(prefix => normalized.startsWith(prefix))
  )) ?? null
}

export function bolt11NetworkForChains (chains = []) {
  const chainSet = new Set(chains)
  return BOLT11_BITCOIN_NETWORKS.find(({ chainIds }) => (
    chainIds.some(chainId => chainSet.has(chainId))
  )) ?? null
}

export function assertBolt11MatchesChains (bolt11, chains) {
  const invoiceNetwork = bolt11Network(bolt11)
  if (!invoiceNetwork) {
    throw new InvalidBolt11Error()
  }

  const localNetwork = bolt11NetworkForChains(chains)
  if (!localNetwork) {
    throw new Bolt11Error('unable to determine local bitcoin network')
  }

  if (invoiceNetwork !== localNetwork) {
    throw new Bolt11Error(`wallet invoice is for ${invoiceNetwork.name}, but SN node is on ${localNetwork.name}`)
  }
}

export function bolt11Msats (bolt11) {
  const amount = bolt11Section(safeDecodeBolt11(bolt11), 'amount')?.value
  const msats = amount ? BigInt(amount) : 0n
  return msats > 0n ? msats : null
}

export function assertBolt11Msats (bolt11, expectedMsats) {
  const decoded = safeDecodeBolt11(bolt11)
  if (!decoded) {
    throw new InvalidBolt11Error()
  }
  const actualMsats = bolt11Section(decoded, 'amount')?.value
  if (!actualMsats || BigInt(actualMsats) !== BigInt(expectedMsats)) {
    throw new Bolt11AmountMismatchError({ actualMsats, expectedMsats })
  }
}

export function bolt11Description (bolt11) {
  return bolt11Section(safeDecodeBolt11(bolt11), 'description')?.value?.trim()
}

export function bolt11ToPayment (bolt11) {
  const decoded = safeDecodeBolt11(bolt11)
  const amount = bolt11Section(decoded, 'amount')?.value
  return {
    bolt11,
    hash: bolt11Section(decoded, 'payment_hash')?.value,
    msatsRequested: amount ? BigInt(amount) : null
  }
}

export function bolt11QrTransform (value) {
  return `lightning:${value.toUpperCase()}`
}

export function normalizeBolt11PaymentRequest (value) {
  let current = value?.trim() ?? ''
  if (!current) return current

  // Peel `lightning=` query params and `lightning:` prefixes repeatedly so nested
  // forms like `bitcoin:...?lightning=lightning:lnbc1...` unwrap to the bare
  // BOLT11; the loop cap guards against pathological inputs.
  for (let i = 0; i < 4; i++) {
    const next = peelLightningWrapping(current)
    if (next === current) return current
    current = next.trim()
  }
  return current
}

function peelLightningWrapping (raw) {
  try {
    const url = new URL(raw)
    for (const [key, lightning] of url.searchParams) {
      if (key.toLowerCase() === 'lightning' && lightning) return lightning
    }
  } catch {
    // Not a URL-like payment target; fall through to prefix handling.
  }

  if (raw.toLowerCase().startsWith('lightning:')) {
    return raw.slice('lightning:'.length)
  }
  return raw
}
