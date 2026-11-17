import { datePivot, isAbortLike, raceAbort, throwIfAborted } from '@/lib/time'
import { authenticatedLndGrpc } from '@/lib/lnd'
import { createInvoice as lndCreateInvoice, getInvoice } from 'ln-service'
import { WalletPermissionsError } from '@/wallets/lib/errors'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS, WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS } from '@/lib/constants'

export const name = 'LND_GRPC'
export const supportsDescriptionHash = true

export const createInvoice = async (
  { msats, description, descriptionHash, expiry },
  { cert, macaroon, socket },
  { signal } = {}
) => {
  try {
    throwIfAborted(signal)
    const { lnd } = authenticatedLndGrpc({
      socket,
      macaroon,
      cert,
      deadline: Date.now() + WALLET_CREATE_INVOICE_TIMEOUT_MS
    }, true)

    const invoice = await raceAbort(
      lndCreateInvoice({
        lnd,
        ...(descriptionHash ? { description_hash: descriptionHash } : { description }),
        mtokens: String(msats),
        expires_at: datePivot(new Date(), { seconds: expiry })
      }).finally(() => {
        // raceAbort only stops waiting. Keep the channels open until ln-service
        // finishes AddInvoice and its follow-up LookupInvoice (or the deadline).
        Object.values(lnd).forEach(client => client.close())
      }),
      signal
    )

    return invoice.request
  } catch (err) {
    if (isAbortLike(err)) throw err
    // LND errors can be in this shape: [code, type, { err: { code, details, metadata } }]
    const lndErr = unwrapLndError(err)
    const details = lndErr?.details || lndErr?.message || lndErr?.toString?.()
    throw lndConnectionError(err) ?? new Error(details)
  }
}

export const checkInvoice = async (
  { hash, invoiceExpiresAt },
  { cert, macaroon, socket },
  { signal } = {}
) => {
  throwIfAborted(signal)
  const { lnd } = authenticatedLndGrpc({
    cert,
    macaroon,
    socket,
    // raceAbort stops waiting; a deadline also terminates an in-flight RPC.
    deadline: Date.now() + WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS
  }, true)
  let invoice
  try {
    invoice = await raceAbort(getInvoice({ id: hash, lnd }), signal)
  } catch (err) {
    if (isAbortLike(err)) throw err
    if (isLndPermissionError(err)) throw new WalletPermissionsError('lnd macaroon cannot read invoices')
    throw lndConnectionError(err) ?? err
  } finally {
    // each call builds its own channels; an unclosed one holds a proxy tunnel
    Object.values(lnd).forEach(client => client.close())
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

function lndConnectionError (err) {
  const lndErr = unwrapLndError(err)
  // grpc-js discards both CONNECT refusals and proxy request errors. Only replace
  // its empty UNAVAILABLE detail; retain any concrete error or resolution note.
  if (lndErr?.code === 14 && /^No connection established\. Last error: undefined\.(?: Resolution note:\s*)?$/.test(lndErr.details)) {
    return new Error('Could not reach your LND node through our gateway. Check the node address and availability, then retry. If this persists, contact support.', { cause: err })
  }
}
