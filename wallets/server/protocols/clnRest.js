import { createInvoice as clnCreateInvoice } from '@/lib/cln'

export const name = 'CLN_REST'

export const createInvoice = async (
  { msats, description, expiry },
  { socket, rune, cert },
  { signal }
) => {
  const inv = await clnCreateInvoice(
    {
      msats,
      description,
      expiry
    },
    {
      socket,
      rune,
      cert
    },
    { signal })

  return inv.bolt11
}

export const testCreateInvoice = async ({ socket, rune, cert }, { signal }) => {
  return await createInvoice(
    { msats: 1000, expiry: 1, description: 'SN test invoice' },
    { socket, rune, cert },
    { signal }
  )
}
