import { decodeBech32, generateSecretKey, newNdebitPaymentRequest, SendNdebitRequest, SimplePool } from '@shocknet/clink-sdk'
import { WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import { WalletPaymentRejectedError } from '@/wallets/client/errors'
import { raceAbort } from '@/lib/time'
import { bolt11ToPayment } from '@/lib/bolt11'
import { msatsToSats } from '@/lib/format'

export const name = 'CLINK'
// ndebit/CLINK has no protocol-level routing fee cap.
export const enforcesMaxFee = false

// GFY codes that can only occur before payment attempt.
const CLINK_PREFLIGHT_GFY_CODES = new Set([
  3, // Expired Request
  4, // Rate Limited
  5, // Invalid Amount
  6 // Invalid Request
])

export async function sendPayment (bolt11, { ndebit, secretKey }, { signal, timeout = WALLET_SEND_PAYMENT_TIMEOUT_MS } = {}) {
  const { data: { pubkey, relay, pointer } } = decodeBech32(ndebit)

  const pool = new SimplePool()
  // Some services reject requests without amount_sats, even for fixed invoices.
  const { msatsRequested } = bolt11ToPayment(bolt11)
  const request = newNdebitPaymentRequest(bolt11, msatsRequested != null ? msatsToSats(msatsRequested) : undefined, pointer)

  let response
  try {
    response = await raceAbort(
      SendNdebitRequest(pool, Buffer.from(secretKey, 'hex'), [relay], pubkey, request, Math.ceil(timeout / 1000)),
      signal
    )
  } catch (e) {
    // the clink SDK throws strings; everything (including aborts) rethrows unwrapped
    throw typeof e === 'string' ? new Error(e) : e
  } finally {
    pool.close([relay])
  }

  if (response.res === 'GFY') {
    // Codes 1/2 can arrive after approval, while the payment may still settle.
    if (CLINK_PREFLIGHT_GFY_CODES.has(response.code)) {
      throw new WalletPaymentRejectedError(response.error)
    }
    throw new Error(response.error || 'clink service reported an ambiguous failure')
  }

  // No preimage means an intra-ledger settlement: the payment settled but we
  // can't prove it. Return it so the external transaction classifier records
  // UNKNOWN rather than reporting a hard failure.
  return response.preimage
}

export function testSendPayment ({ ndebit }, { signal }) {
  // For budgets to work, we need to encrypt and sign the debit request events with the same secret key.
  // Normally, this should be the service's secret key, so the wallet can also fetch nostr metadata
  // and display it for verification purposes, but that would require the client to send the credentials
  // in plaintext to the server for it to encrypt and sign, making it basically custodial.
  //
  // So instead, we are generating a new secret key per user here.
  const secretKey = Buffer.from(generateSecretKey()).toString('hex')
  return { ndebit, secretKey }
}
