import { datePivot, isAbortLike, raceAbort } from '@/lib/time'
import { authenticatedLndGrpc } from '@/lib/lnd'
import { createInvoice as lndCreateInvoice } from 'ln-service'
import { TOR_REGEXP } from '@/lib/url'

export const name = 'LND_GRPC'

export const createInvoice = async (
  { msats, description, descriptionHash, expiry },
  { cert, macaroon, socket },
  { signal } = {}
) => {
  try {
    const isOnion = TOR_REGEXP.test(socket)

    const { lnd } = authenticatedLndGrpc({
      socket,
      macaroon,
      cert
    }, isOnion)

    const invoice = await raceAbort(
      lndCreateInvoice({
        lnd,
        description,
        description_hash: descriptionHash,
        mtokens: String(msats),
        expires_at: datePivot(new Date(), { seconds: expiry })
      }),
      signal
    )

    return invoice.request
  } catch (err) {
    if (isAbortLike(err)) throw err
    // LND errors can be in this shape: [code, type, { err: { code, details, metadata } }]
    const details = (Array.isArray(err) ? err[2]?.err?.details : null) || err.message || err.toString?.()
    throw new Error(details)
  }
}

export const testCreateInvoice = async ({ cert, macaroon, socket }, { signal } = {}) => {
  return await createInvoice({ msats: 1000, expiry: 1 }, { cert, macaroon, socket }, { signal })
}
