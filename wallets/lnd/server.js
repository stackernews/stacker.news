import { datePivot } from '@/lib/time'
import { authenticatedLndGrpc, createInvoice as lndCreateInvoice } from 'ln-service'

export * from 'wallets/lnd'

export const testCreateInvoice = async ({ cert, macaroon, socket }) => {
  return await createInvoice({ msats: 1000, expiry: 1 }, { cert, macaroon, socket })
}

export const createInvoice = async (
  { msats, description, descriptionHash, expiry },
  { cert, macaroon, socket }
) => {
  try {
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
  } catch (err) {
    // LND errors can be in this shape: [code, type, { err: { code, details, metadata } }]
    const details = err[2]?.err?.details || err.message || err.toString?.()
    throw new Error(details)
  }
}
