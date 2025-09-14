import { decodeBech32, generateSecretKey, newNdebitPaymentRequest, SendNdebitRequest, SimplePool } from '@shocknet/clink-sdk'
import { WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'

export const name = 'CLINK'

export async function sendPayment (bolt11, { ndebit }, { signal }) {
  const { data: { pubkey, relay, pointer } } = decodeBech32(ndebit)

  const pool = new SimplePool()
  // TODO: generate secret key once per user and reuse for budgets to work
  const sk = generateSecretKey()
  const request = newNdebitPaymentRequest(bolt11, undefined, pointer)

  let response
  try {
    const timeout = Math.floor(WALLET_SEND_PAYMENT_TIMEOUT_MS / 1000)
    response = await SendNdebitRequest(pool, sk, [relay], pubkey, request, timeout)
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

export function testSendPayment ({ ndebit }, { signal }) {}
