import { createInvoice as clnCreateInvoice } from '@/lib/cln'

export * from '@/wallets/cln'

export const testCreateInvoice = async ({ socket, rune, cert }) => {
  return await createInvoice({ msats: 1000, expiry: 1, description: '' }, { socket, rune, cert })
}

export const createInvoice = async (
  { msats, description, descriptionHash, expiry },
  { socket, rune, cert }
) => {
  const inv = await clnCreateInvoice({
    socket,
    rune,
    cert,
    description,
    descriptionHash,
    msats,
    expiry
  })

  return inv.bolt11
}
