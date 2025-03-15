import { fetchWithTimeout } from '@/lib/fetch'
import { msatsToSats } from '@/lib/format'
import { getAgent } from '@/lib/proxy'
import { assertContentTypeJson, assertResponseOk } from '@/lib/url'

export * from '@/wallets/phoenixd'

export async function testCreateInvoice ({ url, secondaryPassword }, { signal }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { url, secondaryPassword },
    { signal })
}

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { url, secondaryPassword },
  { signal }
) {
  // https://phoenix.acinq.co/server/api#create-bolt11-invoice
  const path = '/createinvoice'

  const headers = new Headers()
  headers.set('Authorization', 'Basic ' + Buffer.from(':' + secondaryPassword).toString('base64'))
  headers.set('Content-type', 'application/x-www-form-urlencoded')

  const body = new URLSearchParams()
  body.append('description', description)
  body.append('amountSat', msatsToSats(msats))

  let hostname = url.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const agent = getAgent({ hostname })

  const res = await fetchWithTimeout(`${agent.protocol}//${hostname}${path}`, {
    method: 'POST',
    headers,
    agent,
    body,
    signal
  })

  assertResponseOk(res)
  assertContentTypeJson(res)

  const payment = await res.json()
  return payment.serialized
}
