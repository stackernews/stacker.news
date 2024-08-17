import { nwcCall } from 'wallets/nwc'
export * from 'wallets/nwc'

export async function testConnectServer ({ nwcUrlRecv }) {
  return await createInvoice({ msats: 1000, expiry: 1 }, { nwcUrlRecv })
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
