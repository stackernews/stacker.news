import { snFetch } from '@/lib/fetch'
import { msatsToSats } from '@/lib/format'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'

export const name = 'PHOENIXD'

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
  body.append('expirySeconds', Math.ceil(expiry / 1000))

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
