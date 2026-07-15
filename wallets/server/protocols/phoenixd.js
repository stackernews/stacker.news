import { snFetch } from '@/lib/fetch'
import { msatsToSats, msatsSatsFloor } from '@/lib/format'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'
import { truncateToCharLength } from '@/lib/validate'
import { assertWalletAuthorized } from '@/wallets/lib/errors'
import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'

export const name = 'PHOENIXD'
// phoenixd only invoices whole sats, so it can receive a request snapped down to the sat grid
export const receivableMsats = msatsSatsFloor
// phoenixd rejects descriptions over 128 chars, so clamp
export const receivableDescription = description => truncateToCharLength(description, 128)

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { url, apiKey },
  { signal }
) {
  const body = new URLSearchParams()
  Object.entries({
    description,
    amountSat: msatsToSats(msats),
    expirySeconds: expiry
  }).forEach(([key, value]) => {
    if (value !== undefined && value !== null) body.append(key, value)
  })

  const payment = await phoenixdRequest({
    url,
    apiKey,
    path: '/createinvoice',
    method: 'POST',
    body,
    signal
  })

  return payment.serialized
}

export async function checkInvoice ({ hash }, { url, apiKey }, { signal }) {
  const payment = await phoenixdRequest({
    url, apiKey, path: `/payments/incoming/${hash}`, method: 'GET', signal, notFoundOk: true
  })
  if (!payment) return { status: 'PENDING' }

  if (payment.isPaid) {
    return {
      status: 'SETTLED',
      preimage: payment.preimage,
      msats: walletAmountToMsatsOrUndefined({ sat: payment.receivedSat }),
      actualFeeMsats: payment.fees,
      settledAt: { milliseconds: payment.completedAt }
    }
  }
  return { status: 'PENDING' }
}

async function phoenixdRequest ({
  url,
  apiKey,
  path,
  method = 'GET',
  body,
  signal,
  timeout,
  notFoundOk = false
}) {
  const headers = new Headers()
  headers.set('Accept', 'application/json')
  headers.set('Authorization', 'Basic ' + Buffer.from(':' + apiKey).toString('base64'))
  if (body) headers.set('Content-Type', 'application/x-www-form-urlencoded')

  const res = await snFetch(url, {
    path,
    method,
    headers,
    body,
    signal,
    timeout
  })

  if (notFoundOk && res.status === 404) return null

  assertWalletAuthorized(res)
  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  return await res.json()
}

export async function testCreateInvoice ({ url, apiKey }, { signal }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { url, apiKey },
    { signal })
}
