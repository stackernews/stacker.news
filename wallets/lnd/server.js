import { datePivot } from '@/lib/time'
import { authenticatedLndGrpc, createInvoice as lndCreateInvoice } from 'ln-service'

export * from 'wallets/lnd'

export const testConnectServer = async (
  { cert, macaroon, socket },
  { me, models }
) => {
  return await createInvoice({ msats: 1, expiry: 1 }, { cert, macaroon, socket })
}

export const createInvoice = async (
  { msats, description, descriptionHash, expiry },
  { cert, macaroon, socket }
) => {
  const { lnd } = await authenticatedLndGrpc({
    cert,
    macaroon,
    socket
  })

  const invoice = await lndCreateInvoice({
    lnd,
    description,
    description_hash: descriptionHash,
    mtokens: String(msats),
    expires_at: datePivot(new Date(), { seconds: expiry })
  })

  return invoice.request
}
