import { WalletConfigurationError, WalletError } from '@/wallets/client/errors'
import { isAbortLike, raceAbort } from '@/lib/time'
import { bolt11ToPayment } from '@/lib/bolt11'
import { verifyPreimage } from '@/wallets/lib/preimage'

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
    // no response is not an attempt claim: throwing lets the payIn flow fail over
    // to the next wallet instead of waiting out the invoice
    throw new WalletError('sendPayment returned no response')
  }

  // WebLN has no independent settlement status: its specified success response
  // is the invoice preimage. A resolution without matching proof is ambiguous,
  // regardless of connector-specific wording.
  const { hash } = bolt11ToPayment(bolt11)
  if (!verifyPreimage(hash, response.preimage)) {
    return {
      status: 'UNKNOWN',
      detail: 'WebLN returned without valid settlement proof'
    }
  }
  return {
    status: 'SETTLED',
    preimage: response.preimage
  }
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
