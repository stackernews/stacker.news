import { decodeBech32, generateSecretKey, newNdebitPaymentRequest, SendNdebitRequest, SimplePool } from '@shocknet/clink-sdk'
import { WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'

export const name = 'CLINK'

export async function sendPayment (bolt11, { ndebit, secretKey }, { signal }) {
  const { data: { pubkey, relay, pointer } } = decodeBech32(ndebit)

  const pool = new SimplePool()
  const request = newNdebitPaymentRequest(bolt11, undefined, pointer)

  let response
  try {
    const timeout = Math.floor(WALLET_SEND_PAYMENT_TIMEOUT_MS / 1000)
    response = await SendNdebitRequest(pool, Buffer.from(secretKey, 'hex'), [relay], pubkey, request, timeout)
  } catch (e) {
    throw typeof e === 'string' ? new Error(e) : e
  } finally {
    pool.close([relay])
  }

  if (response.res === 'GFY') {
    throw new Error(response.error)
  }

  // CLINK will return no preimage if it was an internal transaction
  // but that should never happen for our payments.
  if (!response.preimage) {
    throw new Error('payment settled without preimage')
  }

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
