import { withTimeout } from '@/lib/time'
import { nwcCall, supportedMethods } from 'wallets/nwc'
export * from 'wallets/nwc'

export async function testCreateInvoice ({ nwcUrlRecv }) {
  const timeout = 15_000

  const supported = await withTimeout(supportedMethods(nwcUrlRecv), timeout)

  if (!supported.includes('make_invoice')) {
    throw new Error('make_invoice not supported')
  }

  if (supported.includes('pay_invoice')) {
    throw new Error('pay_invoice must not be supported')
  }

  return await withTimeout(createInvoice({ msats: 1000, expiry: 1 }, { nwcUrlRecv }), timeout)
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
