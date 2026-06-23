export const TERMINAL_STATUSES = new Set(['SETTLED', 'FAILED'])

export const POLLABLE_SETTLEMENT_STATUSES = ['PENDING', 'UNKNOWN']

export const EXTERNAL_TRANSACTION_UNKNOWN_REASONS = {
  TRANSIENT_CHECK_FAILED: 'TRANSIENT_CHECK_FAILED',
  PERMISSION_REQUIRED: 'PERMISSION_REQUIRED',
  VERIFICATION_UNSUPPORTED: 'VERIFICATION_UNSUPPORTED',
  PROOF_UNAVAILABLE: 'PROOF_UNAVAILABLE',
  STATUS_UNAVAILABLE: 'STATUS_UNAVAILABLE'
}

// unknownReason is a pure CAUSE. Whether SN has given up is a separate fact derived from the polling
// deadline + stop-reasons (externalTransactionCheckStopped), so callers never rewrite the cause into a
// "gave up" value.
const UNKNOWN_REASON_MESSAGES = {
  TRANSIENT_CHECK_FAILED: 'SN could not check this wallet yet. The wallet or provider may be temporarily unavailable.',
  PERMISSION_REQUIRED: 'This wallet is missing permission to verify payment status. Update the wallet permissions, then check the wallet again.',
  VERIFICATION_UNSUPPORTED: 'This wallet protocol does not expose payment status verification for this transaction.',
  PROOF_UNAVAILABLE: 'The wallet reported settlement, but did not provide valid proof of payment yet.',
  STATUS_UNAVAILABLE: 'The wallet status endpoint responded, but did not provide a definitive status.'
}

// shown once SN has stopped rechecking (past the polling deadline) for a still-indefinite tx
const CHECK_STOPPED_MESSAGE = 'SN stopped checking after repeated attempts. Check the wallet directly for the final status.'

// causes where retrying can NEVER help, so externalTransactionUnknown stops scheduling rechecks
const STOP_CHECK_REASONS = new Set([
  EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED
])

// Each adapter converts its provider's "not authorized" signal into a WalletPermissionsError at the
// request boundary (lnbits/phoenixd from an HTTP 401/403, lndGrpc from a gRPC permission code, blink/nwc
// from a provider auth error), so we classify by error TYPE here — no transport-detail sniffing.
// PERMISSION_REQUIRED shows the actionable "fix permissions" hint while normal polling continues.
export function externalTransactionUnknownReasonForError (error) {
  return error?.name === 'WalletPermissionsError'
    ? EXTERNAL_TRANSACTION_UNKNOWN_REASONS.PERMISSION_REQUIRED
    : EXTERNAL_TRANSACTION_UNKNOWN_REASONS.TRANSIENT_CHECK_FAILED
}

export function externalTransactionUnknownMessage (reason) {
  return UNKNOWN_REASON_MESSAGES[reason] ?? UNKNOWN_REASON_MESSAGES.STATUS_UNAVAILABLE
}

export function externalTransactionUnknown ({ reason, error = null }) {
  return {
    settlementStatus: 'UNKNOWN',
    unknownReason: reason,
    unknownMessage: externalTransactionUnknownMessage(reason),
    error
  }
}

export function externalTransactionDiagnosticMessage (transaction) {
  if (transaction?.settlementStatus !== 'UNKNOWN') return null
  const reason = transaction.unknownReason
  // a permanent-stop cause already reads as terminal — show its specific message
  if (STOP_CHECK_REASONS.has(reason)) return externalTransactionUnknownMessage(reason)
  // otherwise the cause is recoverable; once we're past the polling deadline, say we've given up
  if (externalTransactionCheckStopped(transaction)) return CHECK_STOPPED_MESSAGE
  return transaction.unknownMessage || externalTransactionUnknownMessage(reason)
}

// --- polling cadence -------------------------------------------------------------------------------
// every 10s for the first minute, then every 30s out to HOT_WINDOW_MS (5 min). After the every-minute
// reaper drives the tail (TAIL_CHECK_INTERVAL_MS staleness), which also backstops a broken chain.

// keep polling this long past a bolt11's expiry so a settlement landing right at expiry (before the
// provider's lookup flips) is still caught instead of being force-failed
export const EXPIRY_GRACE_MS = 5 * 60_000
// hard age wall so a no-expiry invoice or a persistently-unverifiable provider can't poll forever
export const MAX_CHECK_AGE_MS = 24 * 60 * 60_000

// the chain re-arms for this long after creation, then hands the tail off to the reaper
export const HOT_WINDOW_MS = 5 * 60_000
export const TAIL_CHECK_INTERVAL_MS = 45_000

// delay (ms) until the next chain check by elapsed time since creation, or null once the hot window is
// spent (the reaper takes over): every 10s for the first minute, then every 30s out to HOT_WINDOW_MS.
export function externalTransactionNextCheckDelayMs (createdAt) {
  const elapsedMs = Date.now() - new Date(createdAt).getTime()
  if (elapsedMs >= HOT_WINDOW_MS) return null
  return elapsedMs < 60_000 ? 10_000 : 30_000
}

function invoiceExpiry (transaction) {
  return transaction.invoiceExpiresAt ? new Date(transaction.invoiceExpiresAt) : null
}

// stop polling once we pass the deadline: the bolt11 expiry plus a grace window (so a settlement landing
// at expiry is still caught), bounded by a hard age wall (which also bounds no-expiry invoices, since
// invoiceExpiresAt can be null).
export function externalTransactionPollingDeadline (transaction) {
  const expiry = invoiceExpiry(transaction)
  const expiryWall = expiry ? expiry.getTime() + EXPIRY_GRACE_MS : Infinity
  const ageWall = new Date(transaction.createdAt).getTime() + MAX_CHECK_AGE_MS
  return Math.min(expiryWall, ageWall)
}

// the one PENDING case that's a real FAILED: a bolt11 past its expiry + grace with no settlement
export function externalTransactionExpiredUnpaid (transaction) {
  const expiry = invoiceExpiry(transaction)
  return !!expiry && Date.now() >= expiry.getTime() + EXPIRY_GRACE_MS
}

export function externalTransactionCheckStopped (transaction) {
  if (TERMINAL_STATUSES.has(transaction.settlementStatus)) return true
  if (STOP_CHECK_REASONS.has(transaction.unknownReason)) return true
  return Date.now() >= externalTransactionPollingDeadline(transaction)
}

export function externalTransactionBolt11InfoProps (transaction) {
  return {
    bolt11: transaction.bolt11,
    hash: transaction.hash,
    preimage: transaction.preimage,
    msats: transaction.amountMsats,
    expiresAt: transaction.invoiceExpiresAt,
    confirmedAt: transaction.settledAt
  }
}
