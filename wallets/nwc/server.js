import { withTimeout } from '@/lib/time'
import { hasMethod, nwcCall } from 'wallets/nwc'
export * from 'wallets/nwc'

export async function testConnectServer ({ nwcUrlRecv }) {
  await hasMethod(nwcUrlRecv, 'make_invoice')
  return await withTimeout(createInvoice({ msats: 1000, expiry: 1 }, { nwcUrlRecv }), 5000)
}

export async function createInvoice (
  { msats, description, expiry },
  { nwcUrlRecv }) {
  const result = await nwcCall({
    nwcUrl: nwcUrlRecv,
    method: 'make_invoice',
    params: {
      amount: msats,
      description,
      expiry
    }
  })
  return result.invoice
}
