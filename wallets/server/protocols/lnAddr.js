import { fetchWithTimeout } from '@/lib/fetch'
import { msatsSatsFloor } from '@/lib/format'
import { lnAddrOptions } from '@/lib/lnurl'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'

export const name = 'LN_ADDR'

export const createInvoice = async (
  { msats, description },
  { address },
  { signal }
) => {
  const { min, callback, commentAllowed } = await lnAddrOptions(address, { signal })
  const callbackUrl = new URL(callback)

  if (!msats) {
    // use min sendable amount by default
    msats = 1_000 * min
  }

  // create invoices with a minimum amount of 1 sat
  msats = Math.max(msats, 1_000)

  // most lnurl providers suck nards so we have to floor to nearest sat
  msats = msatsSatsFloor(msats)

  callbackUrl.searchParams.append('amount', msats)

  if (commentAllowed >= description?.length) {
    callbackUrl.searchParams.append('comment', description)
  }

  // call callback with amount and conditionally comment
  const method = 'GET'
  const res = await fetchWithTimeout(callbackUrl.toString(), { method, signal })

  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  const body = await res.json()
  if (body.status === 'ERROR') {
    throw new Error(body.reason)
  }

  return body.pr
}

export const testCreateInvoice = async ({ address }, { signal }) => {
  return await createInvoice({ msats: undefined }, { address }, { signal })
}
