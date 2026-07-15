import { datePivot, isAbortLike, raceAbort } from '@/lib/time'
import { authenticatedLndGrpc } from '@/lib/lnd'
import { createInvoice as lndCreateInvoice, getInvoice } from 'ln-service'
import { TOR_REGEXP } from '@/lib/url'
import { WalletPermissionsError } from '@/wallets/lib/errors'

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
    const lndErr = unwrapLndError(err)
    const details = lndErr?.details || lndErr?.message || lndErr?.toString?.()
    throw new Error(details)
  }
}

export const checkInvoice = async (
  { hash, invoiceExpiresAt },
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
      settledAt: invoice.confirmed_at,
      msats: invoice.received_mtokens
    }
  }
  if (invoice.is_canceled) {
    // LND uses CANCELED for both explicit cancellation and its expiry watcher.
    if (new Date(invoiceExpiresAt) <= new Date()) {
      return { status: 'EXPIRED' }
    }
    return {
      status: 'FAILED',
      detail: 'lnd invoice canceled'
    }
  }

  return { status: 'PENDING' }
}

export const testCreateInvoice = async ({ cert, macaroon, socket }, { signal } = {}) => {
  return await createInvoice({ msats: 1000, expiry: 1 }, { cert, macaroon, socket }, { signal })
}

// LND failures may expose either a gRPC code or only text details.
function isLndPermissionError (err) {
  const lndErr = unwrapLndError(err)
  const grpcCode = lndErr?.code
  if (grpcCode === 7 || grpcCode === 16) return true
  const details = lndErr?.details || lndErr?.message || ''
  return /permission denied|unauthenticated|not authorized/i.test(details)
}

function unwrapLndError (err) {
  return Array.isArray(err) ? err[2]?.err ?? err : err
}
