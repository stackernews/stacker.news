import { ensureB64 } from '@/lib/format'
import { datePivot } from '@/lib/time'
import { authenticatedLndGrpc, createInvoice as lndCreateInvoice } from 'ln-service'
import { addWalletLog } from '@/api/resolvers/wallet'

export * from 'wallets/lnd'

export const testConnectServer = async (
  { cert, macaroon, socket },
  { me, models }
) => {
  try {
    cert = ensureB64(cert)
    macaroon = ensureB64(macaroon)

    const { lnd } = await authenticatedLndGrpc({
      cert,
      macaroon,
      socket
    })

    const inv = await lndCreateInvoice({
      description: 'SN connection test',
      lnd,
      tokens: 0,
      expires_at: new Date()
    })

    // we wrap both calls in one try/catch since connection attempts happen on RPC calls
    await addWalletLog({ wallet: { type: 'LND' }, level: 'SUCCESS', message: 'connected to LND' }, { me, models })

    return inv
  } catch (err) {
    // LND errors are in this shape: [code, type, { err: { code, details, metadata } }]
    const details = err[2]?.err?.details || err.message || err.toString?.()
    throw new Error(details)
  }
}

export const createInvoice = async (
  { amount },
  { cert, macaroon, socket },
  { me }
) => {
  const { lnd } = await authenticatedLndGrpc({
    cert,
    macaroon,
    socket
  })

  const invoice = await lndCreateInvoice({
    description: me.hideInvoiceDesc ? undefined : 'autowithdraw to LND from SN',
    lnd,
    tokens: amount,
    expires_at: datePivot(new Date(), { seconds: 360 })
  })

  return invoice.request
}
