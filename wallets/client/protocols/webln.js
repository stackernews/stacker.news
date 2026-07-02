import { WalletConfigurationError, WalletError } from '@/wallets/client/errors'
import { isAbortLike, raceAbort } from '@/lib/time'

export const name = 'WEBLN'
// WebLN's sendPayment does not standardize a fee cap; it relies on the
// provider extension's own budget controls.
export const enforcesMaxFee = false

export async function sendPayment (bolt11, _config, { signal } = {}) {
  // failures up to and including enable() happen before any payment is
  // attempted: a configuration error renders as a definitive, safe-to-retry
  // failure instead of the in-flight warning
  if (typeof window.webln === 'undefined') {
    throw new WalletConfigurationError('lightning browser extension not found')
  }

  try {
    await raceAbort(window.webln.enable(), signal)
  } catch (err) {
    if (isAbortLike(err)) throw err
    throw new WalletConfigurationError(err.message)
  }

  const response = await raceAbort(window.webln.sendPayment(bolt11), signal)
  if (!response) {
    throw new WalletError('sendPayment returned no response')
  }

  // resolution does not always mean settlement: Alby's galoy/Blink connector resolves on a
  // still-PENDING payment with the literal string 'No preimage, payment still pending' in
  // the preimage field. Downstream verifyPreimage rejects any such value, so the send is
  // recorded UNKNOWN/PROOF_UNAVAILABLE rather than trusted as settled.
  return response.preimage
}

export async function testSendPayment (_config, { signal } = {}) {
  if (typeof window.webln === 'undefined') {
    throw new WalletError('lightning browser extension not found')
  }
  // presence alone doesn't prove capability: a locked wallet or a rejected origin passes
  // the check but fails every payment. enable() is the one method every provider must
  // implement, so it doubles as the spec-standard capability probe.
  try {
    await raceAbort(window.webln.enable(), signal)
  } catch (err) {
    if (isAbortLike(err)) throw err
    throw new WalletConfigurationError(err.message || 'wallet did not grant permission')
  }
}
