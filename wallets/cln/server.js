import { createInvoice as clnCreateInvoice } from '@/lib/cln'

export * from '@/wallets/cln'

export const testCreateInvoice = async ({ socket, rune, cert }, { signal }) => {
  return await createInvoice({ msats: 1000, expiry: 1, description: '' }, { socket, rune, cert }, { signal })
}

export const createInvoice = async (
  { msats, description, expiry },
  { socket, rune, cert },
  { signal }) => {
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
