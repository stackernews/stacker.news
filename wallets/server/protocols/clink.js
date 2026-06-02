import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { msatsToSats, msatsSatsFloor } from '@/lib/format'
import { truncateToCharLength } from '@/lib/validate'
import { decodeBech32, generateSecretKey, SendNofferRequest, SimplePool } from '@shocknet/clink-sdk'
import { raceAbort } from '@/lib/time'

export const name = 'CLINK'
// CLINK (noffer) only invoices whole sats, so it can receive a request snapped down to the sat grid
export const receivableMsats = msatsSatsFloor
// the clink SDK hard-rejects descriptions over 100 chars (String.length), so clamp
export const receivableDescription = description => truncateToCharLength(description, 100)

// https://clinkme.dev/specs.html
const ERR_INVALID_AMOUNT = 5

export async function createInvoice (
  { msats, description, expiry },
  { noffer },
  { signal }) {
  const { data: { offer, relay, pubkey } } = decodeBech32(noffer)

  const pool = new SimplePool()
  const sk = generateSecretKey()
  const request = { offer, amount_sats: msatsToSats(msats), expires_in_seconds: expiry, description }

  let response
  try {
    const timeout = Math.floor(WALLET_CREATE_INVOICE_TIMEOUT_MS / 1000)
    // CLINK does not support a custom invoice description or expiry
    response = await raceAbort(
      SendNofferRequest(pool, sk, [relay], pubkey, request, timeout),
      signal
    )
  } catch (e) {
    throw typeof e === 'string' ? new Error(e) : e
  } finally {
    pool.close([relay])
  }

  if ('bolt11' in response && typeof response.bolt11 === 'string') {
    return response.bolt11
  }

  if (response.code === ERR_INVALID_AMOUNT) {
    const { min, max } = response.range
    throw new Error(`invalid amount: amount must be between ${min} and ${max} sats`)
  }

  throw new Error(response.error ?? 'clink invoice failed')
}

export async function testCreateInvoice ({ noffer }, { signal }) {
  return await createInvoice(
    // lnpub minimum range seems to be 10 sats by default so we use 100 sats
    { msats: 100e3, description: 'SN test invoice', expiry: 1 },
    { noffer },
    { signal })
}
