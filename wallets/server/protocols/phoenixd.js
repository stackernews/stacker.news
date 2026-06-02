import { snFetch } from '@/lib/fetch'
import { msatsToSats, msatsSatsFloor } from '@/lib/format'
import { truncateToCharLength } from '@/lib/validate'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'

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
  // https://phoenix.acinq.co/server/api#create-bolt11-invoice
  const headers = new Headers()
  headers.set('Authorization', 'Basic ' + Buffer.from(':' + apiKey).toString('base64'))
  headers.set('Content-type', 'application/x-www-form-urlencoded')

  const body = new URLSearchParams()
  body.append('description', description)
  body.append('amountSat', msatsToSats(msats))
  body.append('expirySeconds', expiry)

  const method = 'POST'
  const res = await snFetch(url, {
    path: '/createinvoice',
    method,
    headers,
    body,
    signal
  })

  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  const payment = await res.json()
  return payment.serialized
}

export async function testCreateInvoice ({ url, apiKey }, { signal }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { url, apiKey },
    { signal })
}
