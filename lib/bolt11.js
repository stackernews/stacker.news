import { decode as decodeBolt11 } from 'light-bolt11-decoder'

// Client-side BOLT11 parsing is for UX only. Server payment validation remains
// authoritative and continues to use ln-service in the payment path.

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

// absolute expiry as a Date (creation timestamp + expiry tag, defaulting to BOLT11's 3600s when the
// invoice carries no expiry tag), or null if the invoice has no timestamp section
export function bolt11ExpiresAt (bolt11) {
  const decoded = safeDecodeBolt11(bolt11)
  const timestamp = bolt11Section(decoded, 'timestamp')?.value
  if (timestamp == null) return null
  const expiry = bolt11Section(decoded, 'expiry')?.value ?? 3600
  return new Date((Number(timestamp) + Number(expiry)) * 1000)
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
