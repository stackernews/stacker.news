import { msatsToSats, toPositiveNumber } from '@/lib/format'
import { abortableSleep, isAbortLike } from '@/lib/time'
import protocols from '@/wallets/client/protocols'

function protocol (name) {
  return protocols.find(protocol => protocol.name === name)
}

// Poll `probe` until `classify` reports a terminal state. Called AFTER a payment
// is submitted, so a failed status read says nothing about the outcome: we keep
// polling until a terminal state or the caller's timeout (whose abort the shell
// renders as "may still be in flight"). The loop NEVER reports a definitive
// failure from a read error — only `classify(...) -> { error }` (a provider-
// reported failure) does. classify(result) returns { value } (settled, return
// it), { error } (terminal failure, throw), or null/undefined (still pending).
export async function pollUntilSettled (probe, classify, { intervalMs, signal }) {
  while (true) {
    let result = null
    try {
      result = await probe()
    } catch (err) {
      if (isAbortLike(err)) throw err
      // transient post-submit read error: treat as still-pending and retry
    }
    const terminal = classify(result)
    if (terminal && 'value' in terminal) return terminal.value
    if (terminal && 'error' in terminal) throw new Error(terminal.error)
    await abortableSleep(intervalMs, signal)
  }
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
