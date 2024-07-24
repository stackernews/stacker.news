import { ensureB64 } from '@/lib/format'
import { createInvoice as clnCreateInvoice } from '@/lib/cln'
import { addWalletLog } from '@/api/resolvers/wallet'

export * from 'wallets/cln'

export const testConnectServer = async (
  { socket, rune, cert },
  { me, models }
) => {
  cert = ensureB64(cert)
  const inv = await clnCreateInvoice({
    socket,
    rune,
    cert,
    description: 'SN connection test',
    msats: 'any',
    expiry: 0
  })
  await addWalletLog({ wallet: { type: 'CLN' }, level: 'SUCCESS', message: 'connected to CLN' }, { me, models })
  return inv
}

export const createInvoice = async (
  { amount },
  { socket, rune, cert },
  { me, models, lnd }
) => {
  cert = ensureB64(cert)

  const inv = await clnCreateInvoice({
    socket,
    rune,
    cert,
    description: me.hideInvoiceDesc ? undefined : 'autowithdraw to CLN from SN',
    msats: amount + 'sat',
    expiry: 360
  })
  return inv.bolt11
}
