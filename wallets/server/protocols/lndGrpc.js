import { datePivot, isAbortLike, raceAbort } from '@/lib/time'
import { authenticatedLndGrpc } from '@/lib/lnd'
import { createInvoice as lndCreateInvoice, getInvoice } from 'ln-service'
import { TOR_REGEXP } from '@/lib/url'
import { WalletPermissionsError } from '@/wallets/client/errors'
import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'

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

export const checkInvoice = async (
  { hash },
  { cert, macaroon, socket },
  { signal } = {}
) => {
  const isOnion = TOR_REGEXP.test(socket)
  const { lnd } = authenticatedLndGrpc({
    cert,
    macaroon,
    socket
  }, isOnion)
  let invoice
  try {
    invoice = await raceAbort(getInvoice({ id: hash, lnd }), signal)
  } catch (err) {
    if (isAbortLike(err)) throw err
    if (isLndPermissionError(err)) throw new WalletPermissionsError('lnd macaroon cannot read invoices')
    throw err
  }

  if (invoice.is_confirmed) {
    return {
      status: 'SETTLED',
      preimage: invoice.secret,
      settledAt: invoice.confirmed_at ? new Date(invoice.confirmed_at) : undefined,
      msats: walletAmountToMsatsOrUndefined(invoice.received_mtokens)
    }
  }
  if (invoice.is_canceled) {
    return {
      status: 'FAILED',
      error: 'lnd invoice canceled'
    }
  }

  return { status: 'PENDING' }
}

export const testCreateInvoice = async ({ cert, macaroon, socket }, { signal } = {}) => {
  return await createInvoice({ msats: 1000, expiry: 1 }, { cert, macaroon, socket }, { signal })
}

// Native LND macaroon failures surface in details, not stable gRPC codes.
function isLndPermissionError (err) {
  const details = (Array.isArray(err) ? err[2]?.err?.details : null) || err?.message || ''
  return /permission denied|unauthenticated|not authorized/i.test(details)
}
