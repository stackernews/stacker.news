import { msatsToSats, toPositiveNumber } from '@/lib/format'
import protocols from '@/wallets/client/protocols'

function protocol (name) {
  return protocols.find(protocol => protocol.name === name)
}

/**
 * Build a protocol balance from an amount already normalized to the display
 * minor unit for its currency. For BTC this is sats; for fiat currencies this
 * is the provider's minor unit, such as cents.
 */
export function walletBalance (amount, currency = 'BTC') {
  if (amount == null || amount === '') return null
  return { amount: toPositiveNumber(amount), currency }
}

/**
 * Build a protocol balance from millisats, normalizing to sats first.
 */
export function msatsWalletBalance (amount, currency = 'BTC') {
  return walletBalance(msatsToSats(amount), currency)
}

export function protocolTestSendPayment ({ name }, config, opts) {
  return protocol(name).testSendPayment(config, opts)
}
