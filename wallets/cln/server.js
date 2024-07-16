import { ensureB64 } from '@/lib/format'

export const server = {
  walletType: 'CLN',
  walletField: 'walletCLN',
  resolverName: 'upsertWalletCLN',
  testConnect: async (
    { socket, rune, cert },
    { me, models, addWalletLog, cln: { createInvoice } }
  ) => {
    cert = ensureB64(cert)
    const inv = await createInvoice({
      socket,
      rune,
      cert,
      description: 'SN connection test',
      msats: 'any',
      expiry: 0
    })
    await addWalletLog({ wallet: { type: 'CLN' }, level: 'SUCCESS', message: 'connected to CLN' }, { me, models })
    return inv
  },
  createInvoice: async (
    { amount },
    { socket, rune, cert },
    { me, models, lnd, cln: { createInvoice } }
  ) => {
    cert = ensureB64(cert)

    const inv = await createInvoice({
      socket,
      rune,
      cert,
      description: me.hideInvoiceDesc ? undefined : 'autowithdraw to CLN from SN',
      msats: amount + 'sat',
      expiry: 360
    })
    return inv.bolt11
  }
}
