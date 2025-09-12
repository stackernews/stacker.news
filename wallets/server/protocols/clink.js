import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { msatsToSats } from '@/lib/format'
import { decodeBech32, generateSecretKey, SendNofferRequest, SimplePool } from '@shocknet/clink-sdk'

export const name = 'CLINK'

// https://clinkme.dev/specs.html
const ERR_INVALID_AMOUNT = 5

export async function createInvoice (
  { msats, description, expiry },
  { noffer },
  { signal }) {
  const { data: { offer, relay, pubkey } } = decodeBech32(noffer)

  // https://github.com/shocknet/clink-demo/blob/94ccde0c984c65b294b73cdd300b3a6868a7fd0c/src/index.ts#L106
  const pool = new SimplePool()
  const sk = generateSecretKey()
  const request = { offer, amount_sats: msatsToSats(msats) }

  let response
  try {
    const timeout = Math.floor(WALLET_CREATE_INVOICE_TIMEOUT_MS / 1000)
    response = await SendNofferRequest(pool, sk, [relay], pubkey, request, timeout)
  } catch (e) {
    throw typeof e === 'string' ? new Error(e) : e
  }

  if ('bolt11' in response && typeof response.bolt11 === 'string') {
    return response.bolt11
  }

  if (response.code === ERR_INVALID_AMOUNT) {
    const { min, max } = response.range
    throw new Error(`invalid amount: amount must be between ${min} and ${max} sats`)
  }

  throw new Error(response.error)
}

export async function testCreateInvoice ({ noffer }, { signal }) {
  return await createInvoice(
    // lnpub minimum range seems to be 10 sats by default so we use 100 sats
    { msats: 100e3, description: 'SN test invoice', expiry: 1 },
    { noffer },
    { signal })
}
