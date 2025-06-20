import { fetchWithTimeout } from '@/lib/fetch'
import { msatsToSats } from '@/lib/format'
import { getAgent } from '@/lib/proxy'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'

export const name = 'PHOENIXD'

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { url, apiKey },
  { signal }
) {
  // https://phoenix.acinq.co/server/api#create-bolt11-invoice
  const path = '/createinvoice'

  const headers = new Headers()
  headers.set('Authorization', 'Basic ' + Buffer.from(':' + apiKey).toString('base64'))
  headers.set('Content-type', 'application/x-www-form-urlencoded')

  const body = new URLSearchParams()
  body.append('description', description)
  body.append('amountSat', msatsToSats(msats))

  const hostname = url.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const agent = getAgent({ hostname })

  const method = 'POST'
  const res = await fetchWithTimeout(`${agent.protocol}//${hostname}${path}`, {
    method,
    headers,
    agent,
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
