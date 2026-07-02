import { verifyPreimage } from '@/wallets/lib/preimage'
import { errorMessage } from '@/lib/error'

export const TERMINAL_STATUSES = new Set(['SETTLED', 'FAILED'])

export const EXTERNAL_TRANSACTION_UNKNOWN_REASONS = {
  TRANSIENT_CHECK_FAILED: 'TRANSIENT_CHECK_FAILED',
  PERMISSION_REQUIRED: 'PERMISSION_REQUIRED',
  VERIFICATION_UNSUPPORTED: 'VERIFICATION_UNSUPPORTED',
  PROOF_UNAVAILABLE: 'PROOF_UNAVAILABLE',
  STATUS_UNAVAILABLE: 'STATUS_UNAVAILABLE'
}

// unknownReason is the cause; "gave up" is derived from polling state.
const UNKNOWN_REASON_MESSAGES = {
  TRANSIENT_CHECK_FAILED: 'SN could not check this wallet yet. The wallet or provider may be temporarily unavailable.',
  PERMISSION_REQUIRED: 'This wallet is missing permission to verify payment status. Update the wallet permissions, then check the wallet again.',
  VERIFICATION_UNSUPPORTED: 'This wallet protocol does not expose payment status verification for this transaction.',
  PROOF_UNAVAILABLE: 'The wallet reported settlement, but did not provide valid proof of payment yet.',
  STATUS_UNAVAILABLE: 'The wallet status endpoint responded, but did not provide a definitive status.'
}

// shown once SN stops rechecking a still-indefinite tx
const CHECK_STOPPED_MESSAGE = 'SN stopped checking after repeated attempts. Check the wallet directly for the final status.'

// causes where retrying cannot help
export const STOP_CHECK_REASONS = new Set([
  EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED
])

// Adapters normalize provider auth failures to WalletPermissionsError.
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
    error
  }
}

// single home for the "protocol has no checker" policy; VERIFICATION_UNSUPPORTED
// is a permanent stop (STOP_CHECK_REASONS), so only these two may hand it out
export function externalTransactionVerificationUnsupported (direction) {
  return externalTransactionUnknown({
    reason: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED,
    error: `wallet protocol cannot verify ${direction === 'RECEIVE' ? 'invoice' : 'payment'} status`
  })
}

export function protocolCanCheckPayment (protocol) {
  return typeof protocol?.checkPayment === 'function'
}

// the { status } adapter-result sibling of externalTransactionVerificationUnsupported
export function verificationUnsupportedResult (error) {
  return {
    status: 'UNKNOWN',
    unknownReason: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED,
    error
  }
}

export function classifyExternalTransactionCheck (transaction, {
  result,
  error,
  stopped = false,
  canCheck = true
} = {}) {
  const direction = transaction?.direction
  const hash = transaction?.hash

  if (result?.status === 'SETTLED') {
    const proofIssue = externalTransactionProofIssue({ direction, hash, result })
    if (proofIssue) {
      return externalTransactionUnknown({
        reason: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.PROOF_UNAVAILABLE,
        error: proofIssue
      })
    }

    const change = {
      settlementStatus: 'SETTLED',
      preimage: result.preimage
    }
    if (result.settledAt != null) change.settledAt = result.settledAt instanceof Date ? result.settledAt.toISOString() : result.settledAt
    if (direction === 'RECEIVE' && result.msats != null) change.amountMsats = String(result.msats)
    if (result.actualFeeMsats != null) change.feeMsats = String(result.actualFeeMsats)
    if (direction === 'RECEIVE') change.error = null
    return change
  }

  if (result?.status === 'FAILED') {
    return {
      settlementStatus: 'FAILED',
      error: result.error || (direction === 'SEND' ? 'provider reports payment failed' : undefined)
    }
  }

  // an expired unpaid receive is locally terminal past the deadline,
  // even when this check errored or was indeterminate
  const pastDeadline = stopped || Date.now() >= externalTransactionPollingDeadline(transaction)
  if (pastDeadline && direction === 'RECEIVE' && externalTransactionExpiredUnpaid(transaction)) {
    return { settlementStatus: 'FAILED', error: 'invoice expired' }
  }

  if (result?.status === 'UNKNOWN') {
    return externalTransactionUnknown({
      reason: result.unknownReason ??
        (!canCheck
          ? EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED
          : error ? externalTransactionUnknownReasonForError(error) : EXTERNAL_TRANSACTION_UNKNOWN_REASONS.STATUS_UNAVAILABLE),
      error: result.error ?? (error ? errorMessage(error) : null)
    })
  }

  if (error) {
    return externalTransactionUnknown({
      reason: externalTransactionUnknownReasonForError(error),
      error: errorMessage(error)
    })
  }

  if (pastDeadline) {
    return externalTransactionUnknown({
      reason: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.STATUS_UNAVAILABLE,
      error: `gave up confirming ${direction === 'SEND' ? 'send' : 'receive'} before a definitive status`
    })
  }

  // after the deadline checks so a stopped no-checker row still reads as "gave up"
  if (!canCheck) return externalTransactionVerificationUnsupported(direction)

  if (direction === 'SEND' && transaction?.settlementStatus === 'UNKNOWN') {
    return { settlementStatus: 'UNKNOWN' }
  }

  return {
    settlementStatus: 'PENDING',
    error: null,
    unknownReason: null
  }
}

function externalTransactionProofIssue ({ direction, hash, result }) {
  if (direction !== 'SEND') return null
  if (!result.preimage) return 'provider reported settlement without proof of payment'
  if (!verifyPreimage(hash, result.preimage)) return 'provider reported settlement with invalid proof of payment'
  return null
}

export function externalTransactionDiagnosticMessage (transaction) {
  if (transaction?.settlementStatus !== 'UNKNOWN') return null
  const reason = transaction.unknownReason
  // Permanent-stop causes already read as terminal.
  if (STOP_CHECK_REASONS.has(reason)) return externalTransactionUnknownMessage(reason)
  // Recoverable causes show "gave up" only after the polling deadline.
  if (externalTransactionCheckStopped(transaction)) return CHECK_STOPPED_MESSAGE
  return externalTransactionUnknownMessage(reason)
}

// Catch settlements that land near expiry before the provider lookup flips.
export const EXPIRY_GRACE_MS = 5 * 60_000
// Hard age wall for no-expiry invoices and persistently-unverifiable providers.
export const MAX_CHECK_AGE_MS = 24 * 60 * 60_000

function invoiceExpiry (transaction) {
  return transaction.invoiceExpiresAt ? new Date(transaction.invoiceExpiresAt) : null
}

// Stop after bolt11 expiry + grace, bounded by the hard age wall.
export function externalTransactionPollingDeadline (transaction) {
  const expiry = invoiceExpiry(transaction)
  const expiryWall = expiry ? expiry.getTime() + EXPIRY_GRACE_MS : Infinity
  const ageWall = new Date(transaction.createdAt).getTime() + MAX_CHECK_AGE_MS
  return Math.min(expiryWall, ageWall)
}

// The one PENDING case that's a real FAILED.
export function externalTransactionExpiredUnpaid (transaction) {
  const expiry = invoiceExpiry(transaction)
  return !!expiry && Date.now() >= expiry.getTime() + EXPIRY_GRACE_MS
}

export function externalTransactionCheckStopped (transaction) {
  if (TERMINAL_STATUSES.has(transaction.settlementStatus)) return true
  if (STOP_CHECK_REASONS.has(transaction.unknownReason)) return true
  return Date.now() >= externalTransactionPollingDeadline(transaction)
}

// A row is final once it's terminal, or once it's a "stopped" UNKNOWN (SN has given up
// checking — permanent stop-reason or past the polling deadline). A stopped PENDING row
// is NOT final: it still needs one last write to become a final UNKNOWN/FAILED.
export function externalTransactionFinal (transaction) {
  if (TERMINAL_STATUSES.has(transaction.settlementStatus)) return true
  return transaction.settlementStatus === 'UNKNOWN' && externalTransactionCheckStopped(transaction)
}

// A stopped row that classify can still terminalize without a provider answer
// (expired unpaid receive → FAILED 'invoice expired'), so checks shouldn't skip it.
export function externalTransactionResolvesLocally (transaction) {
  return transaction.direction === 'RECEIVE' &&
    !STOP_CHECK_REASONS.has(transaction.unknownReason) &&
    externalTransactionExpiredUnpaid(transaction)
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
