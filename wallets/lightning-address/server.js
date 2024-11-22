import { msatsSatsFloor } from '@/lib/format'
import { lnAddrOptions } from '@/lib/lnurl'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'

export * from '@/wallets/lightning-address'

export const testCreateInvoice = async ({ address }) => {
  return await createInvoice({ msats: 1000 }, { address })
}

export const createInvoice = async (
  { msats, description },
  { address }
) => {
  const { callback, commentAllowed } = await lnAddrOptions(address)
  const callbackUrl = new URL(callback)

  // most lnurl providers suck nards so we have to floor to nearest sat
  msats = msatsSatsFloor(msats)

  callbackUrl.searchParams.append('amount', msats)

  if (commentAllowed >= description?.length) {
    callbackUrl.searchParams.append('comment', description)
  }

  // call callback with amount and conditionally comment
  const res = await fetch(callbackUrl.toString())

  assertResponseOk(res)
  assertContentTypeJson(res)

  const body = await res.json()
  if (body.status === 'ERROR') {
    throw new Error(body.reason)
  }

  return body.pr
}
