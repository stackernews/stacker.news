import { withTimeout } from '@/lib/time'
import { hasMethod, nwcCall } from 'wallets/nwc'
export * from 'wallets/nwc'

export async function testCreateInvoice ({ nwcUrlRecv }) {
  const supported = await hasMethod(nwcUrlRecv, 'make_invoice')
  if (!supported) {
    throw new Error('make_invoice not supported')
  }

  const unrestricted = await hasMethod(nwcUrlRecv, 'pay_invoice')
  if (unrestricted) {
    throw new Error('pay_invoice must not be supported')
  }

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
