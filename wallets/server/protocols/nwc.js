import { nwcTryRun } from '@/wallets/lib/protocols/nwc'

export const name = 'NWC'

export async function createInvoice ({ msats, description, expiry }, { url }, { signal }) {
  const result = await nwcTryRun(
    nwc => nwc.req('make_invoice', { amount: msats, description, expiry }),
    { url },
    { signal }
  )
  return result.result.invoice
}

export async function testCreateInvoice ({ url }, { signal }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { url },
    { signal }
  )
}
