import { msatsToSats } from '@/lib/format'
import { callApi } from '@/wallets/phoenixd'

export * from '@/wallets/phoenixd'

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
  const payment = await callApi('createinvoice', {
    description,
    amountSat: msatsToSats(msats)
  }, {
    url,
    password: secondaryPassword
  })
  return payment.serialized
}
