import { fetchWithTimeout } from '@/lib/fetch'
import { msatsSatsFloor } from '@/lib/format'
import { lnAddrOptions } from '@/lib/lnurl'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'

export * from '@/wallets/lightning-address'

export const testCreateInvoice = async ({ address }, { signal }) => {
  return await createInvoice({ msats: 1000 }, { address }, { signal })
}

export const createInvoice = async (
  { msats, description },
  { address },
  { signal }
) => {
  const { callback, commentAllowed } = await lnAddrOptions(address, { signal })
  const callbackUrl = new URL(callback)

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
