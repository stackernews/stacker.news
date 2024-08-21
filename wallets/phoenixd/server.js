import { msatsToSats } from '@/lib/format'

export * from 'wallets/phoenixd'

export async function testCreateInvoice ({ url, secondaryPassword }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { url, secondaryPassword })
}

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { url, secondaryPassword }
) {
  // https://phoenix.acinq.co/server/api#create-bolt11-invoice
  const path = '/createinvoice'

  const headers = new Headers()
  headers.set('Authorization', 'Basic ' + Buffer.from(':' + secondaryPassword).toString('base64'))
  headers.set('Content-type', 'application/x-www-form-urlencoded')

  const body = new URLSearchParams()
  body.append('description', description)
  body.append('amountSat', msatsToSats(msats))

  const res = await fetch(url + path, {
    method: 'POST',
    headers,
    body
  })
  if (!res.ok) {
    const error = await res.text()
    throw new Error(error)
  }

  const payment = await res.json()
  return payment.serialized
}
